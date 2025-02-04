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
self.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
  if (errored) {
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
        console.log("[encoder] error", error)
        errored = true
      },
      output(chunk, meta) {
        if (socket.readyState !== globalThis.WebSocket.OPEN) {
          encoder.flush()
          try {
            socket = new WebSocket(websocketUrl)
          } catch {
            errored = true
          }
          return
        }
        // console.log("[encoder] output", chunk)
        if (chunk.type !== "key") {
          throw new Error("chunk type was not key, it should be")
        }
        if (meta?.decoderConfig) {
          console.log("[worker] meta", meta.decoderConfig)
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
      console.log("[worker] cannot encode before started")
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
