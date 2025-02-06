if (globalThis.AudioData === undefined) {
  /**
   * The AudioData interface of the WebCodecs API represents a block of raw audio data.
   * It is used as input to the AudioEncoder and output from the AudioDecoder.
   *
   * - [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData)
   * - [Specification](https://w3c.github.io/webcodecs/#audiodata-interface)
   */
  globalThis.AudioData = class AudioData {
    // Properties
    private _closed = false;
    private _data: Uint8Array;

    readonly duration: number;
    readonly format: AudioSampleFormat;
    readonly numberOfChannels: number;
    readonly numberOfFrames: number;
    readonly sampleRate: number;
    readonly timestamp: number;

    constructor(init: AudioDataInit) {
      this._data = new Uint8Array(init.data as ArrayBuffer);
      this.format = init.format;
      this.numberOfChannels = init.numberOfChannels;
      this.numberOfFrames = init.numberOfFrames;
      this.sampleRate = init.sampleRate;
      this.timestamp = init.timestamp;

      const MICROSECONDS_PER_SECOND = 1_000_000;
      this.duration = (this.numberOfFrames / this.sampleRate) * MICROSECONDS_PER_SECOND;
    }

    /**
     * Checks if the instance is closed and throws an error if it is.
     */
    private _assertNotClosed() {
      if (this._closed) {
        throw new DOMException("AudioData is closed", "InvalidStateError");
      }
    }

    /**
     * Returns the size in bytes required to hold the sample data based on the options provided.
     */
    allocationSize({
      planeIndex = 0,
      frameOffset = 0,
      frameCount = this.numberOfFrames,
      format = this.format
    }: AudioDataCopyToOptions): number {
      this._assertNotClosed();

      if (planeIndex >= this.numberOfChannels) {
        throw new DOMException("Invalid planeIndex", "IndexSizeError");
      }

      // Determine bytes per sample based on format
      const bytesPerSample = this._getBytesPerSample(format);
      return frameCount * bytesPerSample;
    }

    /**
     * Creates a new AudioData object that references the same audio data.
     */
    clone(): AudioData {
      this._assertNotClosed();
      return new AudioData({
        data: this._data.slice(),
        format: this.format,
        numberOfChannels: this.numberOfChannels,
        numberOfFrames: this.numberOfFrames,
        sampleRate: this.sampleRate,
        timestamp: this.timestamp
      });
    }

    /**
     * Releases the reference to the media resource and marks this AudioData as closed.
     */
    close(): void {
      this._data = new Uint8Array(0); // Release memory
      this._closed = true;
    }

    /**
     * Copies the audio data to the provided destination buffer.
     */
    copyTo(destination: AllowSharedBufferSource, options: AudioDataCopyToOptions): void {
      this._assertNotClosed();

      const { planeIndex = 0, frameOffset = 0, frameCount = this.numberOfFrames } = options;

      if (!(destination instanceof ArrayBuffer || ArrayBuffer.isView(destination))) {
        throw new TypeError("Destination must be an ArrayBuffer, TypedArray, or DataView.");
      }

      if (planeIndex >= this.numberOfChannels) {
        throw new DOMException("Invalid planeIndex", "IndexSizeError");
      }

      // Calculate the byte offset and length
      const bytesPerSample = this._getBytesPerSample(this.format);
      const byteOffset = frameOffset * bytesPerSample;
      const byteLength = frameCount * bytesPerSample;

      if (destination.byteLength < byteLength) {
        throw new DOMException("Destination buffer is too small", "DataError");
      }

      const sourceView = new Uint8Array(this._data.buffer, byteOffset, byteLength);
      const destView = new Uint8Array(destination as ArrayBuffer);
      destView.set(sourceView);
    }

    /**
     * Returns the bytes per sample for the given format.
     */
    private _getBytesPerSample(format: AudioSampleFormat): number {
      switch (format) {
        case "u8":
        case "u8-planar":
          return 1;
        case "s16":
        case "s16-planar":
          return 2;
        case "s32":
        case "s32-planar":
        case "f32":
        case "f32-planar":
          return 4;
        default:
          throw new DOMException("Unsupported format", "NotSupportedError");
      }
    }
  };
}
