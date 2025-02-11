import * as macros from "../../macros" with { type: "macro" };
import "../es-2024"
import { SafariEncodeWorker } from './worker-shim';

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
    console.log("[encoder] add worker")
    if (!Encoder.loaded) {
      Encoder.addModule(context)
      throw new Error("[encoder] cannot create encoder before processor module added")
    }
    const worker = loadWorker(config)
    const node = new AudioWorkletNode(context, "encode-processor")
    // transfer the processor port directly to the worker
    worker.postMessage({
      type: "port",
      port: node.port,
    }, [node.port])
    return new Encoder(context, node)
  }
}

function loadWorker(config: EncoderConfig) {
  const protocol = window.location.protocol.replace("http", "ws")
  const updatedConfig = {
    ...config,
    websocketUrl: config.websocketUrl ?? `${protocol}//${window.location.host}`,
  }

  // const str = macros.minified("src/encoder/worker.ts")
  // const url = config.workerUrl ?? URL.createObjectURL(new Blob([str], { type: "application/javascript" }))
  const needsPolyfill = globalThis.AudioEncoder === undefined
  const worker = needsPolyfill
    ? SafariEncodeWorker()
    : new Worker(updatedConfig?.workerUrl ?? "./worker.js", { type: "module" })
  console.log("[encoder] added worker", worker)
  worker.postMessage({
    type: "start",
    ...updatedConfig
  })
  return worker
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
