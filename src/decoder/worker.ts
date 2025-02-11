export interface BufferMessage {
  type: "buffer"
  // view of Float32 planar data
  data: ArrayBuffer,
  // how many samples per channel have been processed so far, like an index
  // frame: number
  // how many microseconds have passed since started
  timestamp: number
  numberOfChannels: number
  numberOfFrames: number
  duration: number
  frame: number
}

export interface StartMessage {
  type: "start"
  // the audio processor node port
  port: MessagePort
  websocketUrl: string,
  bitratePerChannel?: number,
  frameDuration?: number,
  isPolyfill?: boolean
}
export type WorkerMessage = BufferMessage | StartMessage

export function init() {
  console.log("[worker] init")
  const sampleRate = 48_000 as const
  const codec = "opus" as const
  const numberOfChannels = 2 as const
  const KEY_OFFSET = 0 as const
  const TIMESTAMP_OFFSET = 4 as const
  const DURATION_OFFSET = 8 as const
  const HEADER_SIZE = 12 as const

  // first chunk is 2568 rest 2880 frames
  // so 5760 bytes
  const NUM_FRAMES = 360;
  const BYTE_SIZE = 8
  const copyBuffer = new Float32Array(NUM_FRAMES * BYTE_SIZE * numberOfChannels)

  let isPolyfill = false

  const decoder = new AudioDecoder({
    error(error) {
      console.log("[decoder] error", error)
    },
    output(output) {
      let nf = output.numberOfFrames
      output.copyTo(copyBuffer.subarray(0, nf), {
        planeIndex: 0, // Left channel
        format: "f32-planar",
      });
      // for some reason the right channel sounds choppy
      // when using the AudioDecoder polyfill (eg on safari)
      // so we use mono instead
      output.copyTo(copyBuffer.subarray(nf), {
        planeIndex: isPolyfill ? 0 : 1,
        format: "f32-planar",
        frameOffset: 0
      });
      const msg: BufferMessage = {
        type: "buffer",
        data: copyBuffer.buffer,
        timestamp: output.timestamp,
        numberOfFrames: nf,
        numberOfChannels: output.numberOfChannels,
        duration: output.duration,
        frame: Math.floor(output.timestamp / 1_000_000 * 48_000)
      }
      port?.postMessage(msg)
      output.close()
    }
  })

  const config: AudioDecoderConfig = {
    codec,
    numberOfChannels,
    sampleRate,
    // When defining description it fails when using WebCodecs Polyfill for safari
    // seems we don't need it anyway
    // description: Uint8Array.from([79, 112, 117, 115, 72, 101, 97, 100, 1, 2, 56, 1, 128, 187, 0, 0, 0, 0, 0]).buffer
  }
  const isSupported = AudioDecoder.isConfigSupported(config)
    .then(supported => {
      console.log("[worker] config supported", supported.supported)
  }).catch(e => {
    console.log("[worker] config support error", e)
  })

  console.log("[worker] configure", config)
  decoder.configure(config)
  console.log("[worker] configured")

  decoder.ondequeue = (ev) => {
    // console.log("[decoder] dequeue")
  }

  let port: MessagePort | undefined

  async function onmessage ({ data }: MessageEvent<WorkerMessage>) {
    const type = data.type
    console.log("[worker] msg", data)
    if (type === "start") {
      if (data.isPolyfill) {
        isPolyfill = true
      }
      port = data.port
      const ws = new WebSocket(data.websocketUrl)
      ws.onmessage = async (ev: MessageEvent<string | Blob>) => {
        if (typeof ev.data === "string") {
          console.log("[ws] message", ev.data)
          return
        } else {
          // console.log("[ws] message", ev.data.length)
        }
        const view = new DataView(await ev.data.arrayBuffer())
        const type =  view.getUint32(KEY_OFFSET) === 0 ? "key" : "delta"
        const data = view.buffer.slice(HEADER_SIZE)
        const encodedChunk = new EncodedAudioChunk({
          type,
          timestamp: view.getUint32(TIMESTAMP_OFFSET),
          duration: view.getUint32(DURATION_OFFSET),
          data: data,
          transfer: [view.buffer, data]
        })
        // console.log("[worker] chunk", encodedChunk)
        if (decoder.state === "configured") {
          // do not flush decoder it messes up the audio
          decoder.decode(encodedChunk)
        } else {
          console.log("[worker] decode state is", decoder.state)
        }
      }
      ws.onopen = (ev) => {
        ws.send("hello from decoder")
      }
      ws.onerror = (ev) => {
        console.log("[ws] error", ev)
      }
    }
  }
  return {
    onmessage
  }
}

if (globalThis.self.window === undefined) {
  const context = init()
  self.onmessage = context.onmessage
  globalThis.self.onmessage = context.onmessage
}
