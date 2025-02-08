export interface BufferMessage {
  type: "buffer"
  data: ArrayBuffer,
  // how many samples per channel have been processed so far, like an index
  // frame: number
  // how many microseconds have passed since started
  timestamp: number
  numberOfFrames: number
}

export interface StartMessage {
  type: "start"
  protocol: string
  websocketUrl: string,
  bitratePerChannel?: number,
  frameDuration?: 2_500 | 5_000 | 10_000 | 20_000 | 40_000 | 60_000
}

export interface PortMessage {
  type: "port",
  port: MessagePort
}

export type WorkerMessage = BufferMessage | StartMessage | PortMessage


export function init() {
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

  let state: "init" | "started" = "init"

  let errored = false
  async function onlymessage ({ data }: MessageEvent<WorkerMessage>) {
    if (errored) {
      console.log("ERRORED ALREADY")
      return
    }
    const type = data.type
    console.log("[worker] message", data)
    if (type === "port") {
      data.port.start()
      data.port.onmessage = onlymessage
      data.port.postMessage({type: "start"})
      return
    }
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
          await socketReady
          if (errored || socket.readyState !== globalThis.WebSocket.OPEN) {
            encoder.flush()
            console.warn("[worker] cannot output into errored state")
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
    onmessage: onlymessage
  }
}

if (globalThis.self.window === undefined) {
  const context = init()
  self.onmessage = context.onmessage
}
