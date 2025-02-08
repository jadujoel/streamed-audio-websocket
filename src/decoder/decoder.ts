import * as macros from "../../macros" with { type: "macro" }
import type { BufferMessage, StartMessage } from './worker'
import { SafariDecodeWorker } from './worker-shim'

const START_MESSAGE = { type: "start" } as const
const STOP_MESSAGE = { type: "stop" } as const

if (Promise.withResolvers === undefined) {
  Promise.withResolvers = (() => {
    let resolve
    let reject
    const promise = new Promise((resolve_, reject_) => {
      resolve = resolve_
      reject = reject_
    })
    return { promise, resolve, reject }
  }) as any;
}

const ProcessorImport = {
  started: false,
  done: false,
  ...Promise.withResolvers<void>(),
}

export class Decoder {
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

  static async addModule(context: AudioContext, moduleUrl?: string | URL): Promise<void> {
    if (ProcessorImport.done) {
      return
    }
    if (ProcessorImport.started === true) {
      await ProcessorImport.promise
      return
    }
    const str = macros.minified("src/decoder/processor.ts")
    const url = moduleUrl ?? URL.createObjectURL(new Blob([str], { type: "application/javascript" }))
    console.log(`[decoder] addModule ${url}`)
    const promise = context.audioWorklet.addModule(url)
    ProcessorImport.started = true
    await promise.catch(ProcessorImport.reject)
    ProcessorImport.done = true
    ProcessorImport.resolve()
  }

  static create(context: AudioContext, config: DecoderConfig = {}): Decoder | never {
    console.log("[decoder] create", config)
    if (!Decoder.loaded) {
      Decoder.addModule(context)
      throw new Error("[decoder] cannot create decoder before processor module added")
    }
    const str = macros.minified("src/decoder/worker.ts")
    const url = config.workerUrl ?? URL.createObjectURL(new Blob([str], { type: "application/javascript" }))
    const needsShim = globalThis.AudioDecoder === undefined
    const worker = needsShim
      ? SafariDecodeWorker()
      : new Worker(url, { type: "module" })

    const protocol = window.location.protocol.replace("http", "ws")
    const updatedConfig = {
      ...config,
      websocketUrl: config.websocketUrl ?? `${protocol}//${window.location.host}`,
    } as const satisfies DecoderConfig
    const node = new AudioWorkletNode(context, "decode-processor", {
      outputChannelCount: [2],
      numberOfInputs: 0,
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      numberOfOutputs: 1,
    })
    worker.postMessage(<StartMessage> {
      type: "start",
      port: node.port,
      isPolyfill: needsShim,
      ...updatedConfig
    }, [node.port])
    return new Decoder(context, node)
  }
}


interface DecoderConfig {
  workerUrl?: string
  websocketUrl?: string
  /** @default 48_000 */
  bitratePerChannel?: number
  // values that work: 2_500 | 5_000 | 10_000 | 20_000 | 40_000 | 60_000
  // basically any multiple of 2_500 less than 60_000
  // or 120_000 for mono, i think
  frameDuration?: number
}
