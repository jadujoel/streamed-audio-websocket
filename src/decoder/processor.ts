import type { BufferMessage } from "./worker";

console.log("[decode-processor] initialized");

enum State {
  INIT,
  STARTED,
  STOPPED,
}

type StreamMessage = StartMessage | StopMessage | BufferMessage;

interface StartMessage {
  type: "start";
}
interface StopMessage {
  type: "stop";
}

interface BufferItem extends Omit<BufferMessage, 'left' | 'right' | 'data'> {
  readonly left: Float32Array
  readonly right: Float32Array
}

class DecodeProcessor extends globalThis.AudioWorkletProcessor {
  numChannels = 2;
  state = State.INIT;

  currentFrameAtStarted = 0;
  currentFrame = 0;
  queue: BufferItem[] = [];

  currentItemIndex = 0

  onmessage: (ev: MessageEvent<StreamMessage>) => void = (ev) => {
    const data = ev.data;
    switch (data.type) {
      case "start":
        this.onstartmessage();
        break;
      case "stop":
        this.onstopmessage();
        break;
      case "buffer":
        this.onbuffermessage(data);
        break;
      default:
        console.log("[decode-processor] unknown message", ev.data);
    }
  };

  onstartmessage() {
    console.log("[decode-processor] start message");
  }

  onstopmessage() {
    console.log("[decode-processor] stopped");
    this.state = State.STOPPED;
  }

  onbuffermessage(data: BufferMessage) {
    const pcm_planar = new Float32Array(data.data)
    this.queue.push({
      ...data,
      left: pcm_planar.subarray(0, data.numberOfFrames),
      right: pcm_planar.subarray(data.numberOfFrames)
    });
    if (this.currentItemIndex > 0) {
      this.queue.splice(0, this.currentItemIndex)
      this.currentItemIndex = 0
    }
  }

  constructor(options: AudioWorkletProcessorOptions) {
    super(options);
    this.port.onmessage = this.onmessage;
    console.log('[decode-processor] new', options)
  }

  stop() {
    this.state = State.STOPPED
    this.currentItemIndex = 0
    this.queue.length = 0
    console.log("[decode-processor] stop")
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    if (this.queue.length > 8) {
      if (this.state !== State.STARTED) {
        console.log("[decode-processor] started")
        this.state = State.STARTED
        this.currentFrameAtStarted = globalThis.currentFrame;
      }
    }

    if (this.state !== State.STARTED) {
      return true
    }

    const out0 = outputs[0];
    if (!out0 || out0.length === 0) {
      console.warn("Out length to small")
      return true;
    }

    const left = out0[0];
    const right = out0[1];
    if (left === undefined) {
      console.warn("LEFT IS UNDEFINED")
      return false
    }
    if (right === undefined) {
      console.warn("RIGHT IS UNDEFINED")
      return false
    }

    let item = this.queue[this.currentItemIndex]
    if (item === undefined) {
      this.stop()
      return true
    }
    let buffer_left = item.left
    let buffer_right = item.right

    for (let i = 0; i < left.length; i++) {
      const index = this.currentFrame
      left[i] = buffer_left[index];
      // right[i] = buffer_right[index]
      right[i] = buffer_right[index]
      this.currentFrame += 1
      if (this.currentFrame >= item.numberOfFrames) {
        this.currentFrame = 0
        this.currentItemIndex += 1
        // we should not splice the queue here
        // since its to costly inside the processloop and introduces poopiness
        item = this.queue[this.currentItemIndex]
        if (item === undefined) {
          this.stop()
          return true
        }
        buffer_left = item.left
        buffer_right = item.right
      }
    }
    return true;
  }
}

globalThis.registerProcessor("decode-processor", DecodeProcessor);
declare var globalThis: AudioWorkletGlobalThis
