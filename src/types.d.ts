declare var AudioData: {
  new(options: AudioDataOptions): AudioData
}

declare var AudioEncoder: {
  new(options: AudioEncoderOptions): AudioEncoder
}

declare var EncodedAudioChunk: {
  new(options: EncodedAudioChunkOptions): EncodedAudioChunk
}

declare var AudioDecoder: {
  new(options: AudioDecoderOptions): AudioDecoder
}

declare global {
  interface Window {
    AudioData: typeof AudioData,
    AudioEncoder: typeof AudioEncoder
  }
}

interface AudioEncoder {
  configure: (options: ConfigureOptions) => void
  encode: (data: AudioDataInit) => void
  flush: () => void
}

interface AudioEncoderOptions {
  output: (encodedChunk: EncodedAudioChunk) => void
  error: (err: Error) => void
}

interface ConfigureOptions {
  readonly codec: string,
  readonly sampleRate: number,
  readonly numberOfChannels: number,
  readonly bitrate: number
}

interface EncodedAudioChunkOptions {
  readonly type: 'key' | 'delta',
  readonly timestamp: number,
  readonly duration: number,
  readonly byteLength: number,
  readonly data: ArrayBuffer
}


type TypedArray =
Int8Array | Int16Array | Int32Array | BigInt64Array
| Uint8Array | Uint16Array | Uint32Array | Float32Array | Float64Array

interface EncodedAudioChunk {
  readonly type: 'key' | 'delta',
  readonly timestamp: number,
  readonly duration: number,
  readonly byteLength: number,
  // copyTo: (dest: ArrayBuffer, offset: number) => void
  copyTo: (dest: ArrayBuffer | DataView | TypedArray) => void
}

interface AudioData {
  readonly timestamp: number
  readonly duration: number
  readonly format: 'f32'
  readonly sampleRate: number
  readonly numberOfChannels: number
  readonly numberOfFrames: number
  copyTo: (dest: ArrayBuffer | TypedArray | DataView, options: AudioDataCopyToOptions) => void
}

interface AudioDataOptions {
  readonly timestamp: number, // microseconds
  readonly data: ArrayBufferLike,
  readonly format: 's16',
  readonly sampleRate: number,
  readonly numberOfChannels: number
  readonly numberOfFrames: number,
}

interface AudioDecoderOptions {
  readonly output: (data: AudioData) => void;
  readonly error: (err: Error) => void;
}

interface AudioDecoder {
  readonly decode: (data: EncodedAudioChunk) => void;
  readonly configure: (options: ConfigureOptions) => void;
}

interface AudioDataInit {
  readonly timestamp: number;
  readonly data?: ArrayBuffer;
  readonly format: string;
  readonly sampleRate: number;
  readonly numberOfChannels: number;
  readonly numberOfFrames: number;
}

interface AudioDataCopyToOptions {
  readonly planeIndex: number;
  readonly frameOffset?: number;
  readonly frameCount: number;
  readonly format: AudioSampleFormat;
}

type AudioSampleFormat = 'u8' | 's16' | 's32' | 'f32' | 'u8-planar' | 's16-planar' | 's32-planar' | 'f32-planar';

enum AudioSampleFormat {
  "u8",
  "s16",
  "s32",
  "f32",
  "u8-planar",
  "s16-planar",
  "s32-planar",
  "f32-planar",
};

interface AudioWorkletProcessorOptions<T = unknown> {
  readonly numberOfInputs?: number
  readonly numberOfOutputs?: number
  readonly outputChannelCount?: readonly number[]
  readonly parameterData?: {
    readonly [key: string]: number
  }
  readonly processorOptions?: T
}

type AudioWorkletProcessor<T = unknown> = {
  new (options?: AudioWorkletProcessorOptions<T>): AudioWorkletProcessor;
  readonly port: MessagePort;
};

interface AudioWorkletGlobalThis<TName = string, TProcessor = unknown> {
  readonly sampleRate: number;
  readonly currentTime: number;
  readonly currentFrame: number;
  readonly AudioWorkletProcessor: AudioWorkletProcessor;
  readonly registerProcessor: (name: TName, processor: TProcessor) => void;
}
