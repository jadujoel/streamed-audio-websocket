
enum State {
  INIT,
  STARTED,
  STOPPED,
}

type StreamMessage = StartMessage | StopMessage

interface BufferMessage {
  readonly type: "buffer"
  // signed in16values
  readonly data: ArrayBuffer,
  // how many samples per channel have been processed so far, like an index
  // readonly frame: number
  // how many microseconds have passed since started
  readonly timestamp: number
  // how many microseconds have passed since audiocontext started
  // readonly currentTimeStamp: number
  // how many samples have passed since audiocontext started
  // readonly currentFrame: number
  // how many seconds have passed since audio context started
  // readonly currentTime: number
  readonly numberOfFrames: number
}

interface StartMessage {
  type: "start"
}
interface StopMessage {
  type: "stop"
}

const MICROSEC_FROM_SECONDS_MULTIPLIER = 1_000_000

/**
 *
 */
class EncodeProcessor extends globalThis.AudioWorkletProcessor {
  target = new EventTarget()
  bufferSize = 2880 * 2; // duration 120_000 microsec at 48khz (divisible by 128 samples and by 60_duration)
  buffer = new Int16Array(this.bufferSize * 2)
  frame = 0;
  index = 0;
  bufferedSamples = 0;
  state = State.INIT

  reinitBuffer(): Int16Array {
    return this.buffer = new Int16Array(this.bufferSize * 2)
  }

  onmessage: (ev: MessageEvent<StreamMessage>) => void = (ev) => {
    const data = ev.data;
    console.log("[encode-processor] message", data)
    switch (data.type) {
      case "start":
        this.onstartmessage(data)
        break
      case "stop":
        this.onstopmessage(data)
        break
    }
  }

  onstartmessage = (_data: unknown) => {
    console.log('[encode-processor] started')
    this.state = State.STARTED
  }

  onstopmessage = (_data: unknown) => {
    console.log('[encode-processor] stopped')
    this.state = State.STOPPED
  }

  constructor(options?: AudioWorkletProcessorOptions) {
    console.log('[encode-processor] new', options)
    super(options);
    this.port.onmessage = this.onmessage
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>) {
    if (this.state !== State.STARTED) {
      return true
    }
    const in0 = inputs[0]
    if (!(in0?.length > 0)) {
      return true
    }
    const left = in0[0]
    const right = in0[1]
    const ns = left.length
    for (let i = 0; i < ns; i++) {
      this.buffer[this.index] = left[i] * 0x7FFF
      if (right) {
        this.buffer[this.index + this.bufferSize] = right[i] * 0x7FFF
      }
      this.index += 1
    }
    this.bufferedSamples += ns
    if (this.bufferedSamples >= this.bufferSize) {
      const msg: BufferMessage = {
        type: "buffer",
        data: this.buffer.buffer,
        // frame: this.frame,
        // also doesnt seem to be needed
        timestamp: Math.floor(this.frame * MICROSEC_FROM_SECONDS_MULTIPLIER / globalThis.sampleRate),
        // timestamp: Math.floor(globalThis.currentTime * MICROSEC_FROM_SECONDS_MULTIPLIER) * 8,
        // currentFrame: globalThis.currentFrame,
        // currentTime: globalThis.currentTime,
        // currentTimeStamp: Math.floor(globalThis.currentTime * MICROSEC_FROM_SECONDS_MULTIPLIER),
        numberOfFrames: this.bufferSize
      }
      this.port.postMessage(msg)
      this.bufferedSamples = 0
      this.frame += this.bufferSize
      this.index = 0;
      // since we transfered the buffer we need to reinit
      // this.reinitBuffer()
    }
    return true;
  }
}

globalThis.registerProcessor('encode-processor', EncodeProcessor);
declare var globalThis: AudioWorkletGlobalThis
