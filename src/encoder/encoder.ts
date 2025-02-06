import * as macros from "../../macros" with { type: "macro" }

if (Promise.withResolvers === undefined) {
  Promise.withResolvers = (() => {
    let resolve: any
    let reject: any
    const promise = new Promise((resolve_, reject_) => {
      resolve = resolve_
      reject = reject_
    })
    return { promise, resolve, reject }
  }) as any;
}

const START_MESSAGE = { type: "start" } as const
const STOP_MESSAGE = { type: "stop" } as const

const ProcessorImport = {
  started: false,
  done: false,
  ...Promise.withResolvers<void>(),
}

export class Encoder {
  constructor(
    public readonly context: AudioContext,
    public readonly node: AudioWorkletNode,
  ) {}

  start(): void {
    this.node.port.postMessage(START_MESSAGE)
  }

  stop(): void {
    this.node.port.postMessage(STOP_MESSAGE)
  }

  static get loaded() {
    return ProcessorImport.done
  }

  static async addModule(context: AudioContext, moduleUrl?: string): Promise<void> {
    if (ProcessorImport.done) {
      return
    }
    if (ProcessorImport.started === true) {
      await ProcessorImport.promise
      return
    }
    const str = macros.minified("src/encoder/processor.ts")
    const url = moduleUrl ?? URL.createObjectURL(new Blob([str], { type: "application/javascript" }))
    console.log(`[encoder] addModule ${url}`)
    const promise = context.audioWorklet.addModule(url)
    ProcessorImport.started = true
    await promise.catch(ProcessorImport.reject)
    ProcessorImport.done = true
    ProcessorImport.resolve()
  }

  static create(context: AudioContext, config: EncoderConfig = {}): Encoder {
    console.log("Create Encoder", config)
    console.log("[encoder] add worker")
    if (!Encoder.loaded) {
      Encoder.addModule(context)
      throw new Error("[encoder] cannot create encoder before processor module added")
    }
    const workerPromise = loadWorker(config)
    const node = new AudioWorkletNode(context, "encode-processor")
    node.port.onmessage = async (ev: MessageEvent<BufferMessage>) => {
      const worker = await workerPromise
      worker.postMessage(ev.data, [ev.data.data])
    }
    return new Encoder(context, node)
  }
}

async function loadWorker(config: EncoderConfig) {
  const protocol = window.location.protocol.replace("http", "ws")
  const updatedConfig = {
    ...config,
    websocketUrl: config.websocketUrl ?? `${protocol}//${window.location.host}`,
  }
  if (globalThis.AudioEncoder === undefined) {
    const worker = await pretendWorker(config)
    console.log("[encoder] added worker", worker)
    worker.postMessage({
      type: "start",
      ...updatedConfig
    })
    return worker
  }
  const str = macros.minified("src/encoder/worker.ts")
  const url = config.workerUrl ?? URL.createObjectURL(new Blob([str], { type: "application/javascript" }))
  const worker = new Worker(url, { type: "module" })
  console.log("[encoder] added worker", worker)
  worker.postMessage({
    type: "start",
    ...updatedConfig
  })
  return worker
}

async function pretendWorker(config: EncoderConfig) {
  console.time("polyfill")
  const LibAV = await import('libav.js');
  const { load } = await import("libavjs-webcodecs-polyfill")

  if (Promise.withResolvers === undefined) {
    Promise.withResolvers = (() => {
      let resolve: any
      let reject: any
      const promise = new Promise((resolve_, reject_) => {
        resolve = resolve_
        reject = reject_
      })
      return { promise, resolve, reject }
    }) as any;
  }

  const libavOptions = {
    wasmurl: "libav-6.5.7.1-default.wasm.wasm",
    toImport: "libav-6.5.7.1-default.wasm.mjs",
    noworker: false,
    nothreads: true
  }
  Object.assign(LibAV, libavOptions)
  await load({
    LibAV,
    polyfill: true,
    libavOptions
  })
  console.timeEnd("polyfill")

  const BYTE_SIZE = 8 as const
  const MILLION = 1_000_000 as const
  const KEY_OFFSET = 0 as const
  const TIMESTAMP_OFFSET = 4 as const
  const DURATION_OFFSET = 8 as const
  const HEADER_SIZE = 12 as const

  const format = 's16-planar' as const
  const sampleRate = 48_000 as const
  const codec = "opus" as const
  const numberOfChannels = 2 as const

  let encoder: AudioEncoder
  let socket: WebSocket

  interface BufferMessage {
    type: "buffer"
    data: ArrayBuffer,
    // how many samples per channel have been processed so far, like an index
    // frame: number
    // how many microseconds have passed since started
    timestamp: number
    numberOfFrames: number
  }

  interface StartMessage {
    type: "start"
    // window.location.protocol
    protocol: string
    websocketUrl: string,
    bitratePerChannel?: number,
    frameDuration?: 2_500 | 5_000 | 10_000 | 20_000 | 40_000 | 60_000
  }

  type WorkerMessage = BufferMessage | StartMessage

  let state: "init" | "started" = "init"

  let errored = false

  const onmessage = async ({ data }: MessageEvent<WorkerMessage>) => {
    if (errored) {
      console.log("ERRORED ALREADY")
      return
    }
    const type = data.type
    if (type === "start") {
      if (state !== "init") {
        console.log("[worker] can only start once")
        return
      }
      state = "started"
      const {
          websocketUrl,
          bitratePerChannel = 48_000,
          frameDuration = 60_000
      } = data
      console.log("[worker] config", data)

      const bitrate = bitratePerChannel * numberOfChannels
      const numFrames = bitrate * frameDuration / MILLION
      const dataSize = numFrames / BYTE_SIZE
      const chunkSize = dataSize + HEADER_SIZE

      try {
        socket = new WebSocket(websocketUrl)
      } catch {
        errored = true
        return
      }
      const socketReady = new Promise<void>((resolve) => {
        socket.onopen = () => { resolve() }
      })
      socket.onerror = (ev) => {
        errored = true
      }

      const dataBuffer = new Uint8Array(dataSize)
      const sendView = new DataView(new ArrayBuffer(chunkSize))
      encoder = new AudioEncoder({
        error(error) {
          console.log("[worker] error", error)
          errored = true
        },
        async output(chunk, meta) {
          // console.log("[worker] output", chunk)
          await socketReady
          if (socket.readyState !== globalThis.WebSocket.OPEN) {
            encoder.flush()
            try {
              socket = new WebSocket(websocketUrl)
            } catch {
              errored = true
            }
            return
          }
          if (chunk.type !== "key") {
            throw new Error("chunk type was not key, it should be")
          }
          chunk.copyTo(dataBuffer)
          sendView.setUint32(KEY_OFFSET, chunk.type === "key" ? 0 : 1)
          sendView.setUint32(TIMESTAMP_OFFSET, chunk.timestamp)
          sendView.setUint32(DURATION_OFFSET, chunk.duration ?? 0)
          for (let i = 0; i < chunk.byteLength; i++) {
            sendView.setUint8(i + HEADER_SIZE, dataBuffer[i])
          }
          socket.send(sendView.buffer.slice(0, chunk.byteLength + HEADER_SIZE))
        },
      })
      encoder.ondequeue = (ev) => {
      }
      encoder.configure({
        codec: codec,
        numberOfChannels,
        sampleRate: sampleRate,
        bitrate,
        bitrateMode: "constant",
        opus: {
          format: codec,
          frameDuration
        }
      })

    } else if (type === "buffer") {
      if (state !== "started") {
        console.log("[worker] cannot encode before started", state)
        return
      }
      const wavData = new AudioData({
        format: format,
        sampleRate: sampleRate,
        numberOfChannels,
        data: data.data,
        timestamp: data.timestamp,
        numberOfFrames: data.numberOfFrames,
        transfer: [data.data]
      })
      encoder.encode(wavData)
      // do not flush encoder it makes sound flutter
    }
  }
  return {
    postMessage(message: any) {
      onmessage({ data: message } as any)
    }
  }
}

interface BufferMessage {
  type: "buffer"
  data: ArrayBuffer,
  // how many samples per channel have been processed so far, like an index
  // frame: number
  // how many microseconds have passed since started
  timestamp: number
  numberOfFrames: number
}

interface EncoderConfig {
  workerUrl?: string
  websocketUrl?: string
  /** @default 48_000 */
  bitratePerChannel?: number
  // values that work: 2_500 | 5_000 | 10_000 | 20_000 | 40_000 | 60_000
  // basically any multiple of 2_500 less than 60_000
  // or 120_000 for mono, i think
  frameDuration?: number
}
