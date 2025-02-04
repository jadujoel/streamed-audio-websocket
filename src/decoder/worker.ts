const sampleRate = 48_000 as const
const codec = "opus" as const
const numberOfChannels = 2 as const
const KEY_OFFSET = 0 as const
const TIMESTAMP_OFFSET = 4 as const
const DURATION_OFFSET = 8 as const
const HEADER_SIZE = 12 as const

export interface BufferMessage {
  type: "buffer"
  // Int16Array
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

interface StartMessage {
  type: "start"
  // window.location.protocol
  protocol: string
  websocketUrl: string,
  bitratePerChannel?: number,
  frameDuration?: number
}

const FRAME_DIVIDER = 48_0000 * 1_000_000

type WorkerMessage = BufferMessage | StartMessage

let state: "init" | "started" = "init"

// first chunk is 2568 rest 2880 frames
// so 5760 bytes
const NUM_FRAMES = 360;
const BYTE_SIZE = 8
const copyBuffer = new Int16Array(NUM_FRAMES * BYTE_SIZE * numberOfChannels)
// const copyBuffer = new Float32Array(NUM_FRAMES * BYTE_SIZE * numberOfChannels)
const decoder = new AudioDecoder({
  error(error) {
    console.log("[decoder] error", error)
  },
  output(output) {
    output.copyTo(copyBuffer, {
      planeIndex: 0,
      format: "s16"
      // format: "s16-planar"
      // format: "f32"
    })
    // if (output.duration !== 60_000) {
    //   return
    // }
    // let index = Math.floor(output.timestamp * sampleRate / 1_000_000)
    // const ns = output.duration * sampleRate / 1_000_000
    // const nf = output.numberOfFrames
    const msg: BufferMessage = {
      type: "buffer",
      data: copyBuffer.buffer,
      timestamp: output.timestamp,
      numberOfFrames: output.numberOfFrames,
      numberOfChannels: output.numberOfChannels,
      duration: output.duration,
      frame: Math.floor(output.timestamp / 1_000_000 * 48_000)
    }
    self.postMessage(msg)
    output.close()
  }
})

decoder.configure({
  codec,
  numberOfChannels,
  sampleRate,
  description: Uint8Array.from([79, 112, 117, 115, 72, 101, 97, 100, 1, 2, 56, 1, 128, 187, 0, 0, 0, 0, 0]).buffer
})

decoder.ondequeue = (ev) => {
  // console.log("[decoder] dequeue")
}

self.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
  const type = data.type
  console.log("[decode.worker] msg", data)
  if (type === "start") {
    const ws = new WebSocket(data.websocketUrl)
    ws.onmessage = async (ev: MessageEvent<string | Blob>) => {
      if (typeof ev.data === "string") {
        console.log("[ws] message", ev.data)
        if (ev.data === "start-decode") {

        }
        return
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

      if (decoder.state === "configured") {
        // do not flush decoder it messes up the audio
        decoder.decode(encodedChunk)
      } else {
        console.log("decode state is", decoder.state)
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
