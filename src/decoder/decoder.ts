import * as macros from "../../macros" with { type: "macro" }
import type { StartMessage } from './worker'
import { SafariDecodeWorker } from './worker-shim'

const START_MESSAGE = { type: "start" } as const
const STOP_MESSAGE = { type: "stop" } as const

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

  static async addModule(context: AudioContext, moduleUrl?: string | URL): Promise<void> {
    const str = macros.minified("src/decoder/processor.ts")
    const url = moduleUrl ?? URL.createObjectURL(new Blob([str], { type: "application/javascript" }))
    await context.audioWorklet.addModule(url)
  }

  static create(context: AudioContext, config: DecoderConfig = {}): Decoder | never {
    console.log("[decoder] create", config)
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

export interface DecoderConfig {
  workerUrl?: string
  websocketUrl?: string
  /** @default 48_000 */
  // bitratePerChannel?: number
  // values that work: 2_500 | 5_000 | 10_000 | 20_000 | 40_000 | 60_000
  // basically any multiple of 2_500 less than 60_000
  // or 120_000 for mono, i think
  // frameDuration?: number
}
