
export interface WorkerLikeInit {
  onmessage?: (ev: MessageEvent<any>) => any;
  onmessageerror?: (ev: MessageEvent<any>) => any;
  onerror?: (ev: ErrorEvent) => any;
}

/**
 * A class that mimics the Worker API but runs on the main thread.
 */
export class WorkerLike extends EventTarget {
  #state: "init" | "terminated" = "init";
  channel = new MessageChannel();
  port: MessagePort = this.channel.port1;

  /** The event handler for `message` events. */
  onmessage: ((this: Worker, ev: MessageEvent<any>) => any) | null = null;

  /** The event handler for `messageerror` events. */
  onmessageerror: ((this: Worker, ev: MessageEvent<any>) => any) | null = null;

  /** The event handler for `error` events. */
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null = null;

  constructor(_scriptURL?: string | URL, _options?: WorkerOptions | undefined) {
    super();
    this.channel.port1.start();
    this.channel.port2.start();

    // Forward events from `port1` to this instance
    this.channel.port1.addEventListener("message", (event) => {
      this.onmessage?.call(this as unknown as Worker, event);
    });

    this.channel.port1.addEventListener("messageerror", (event) => {
      this.onmessageerror?.call(this as unknown as Worker, event);
    });
  }

  /**
   * Sends a message using `MessagePort`.
   */
  postMessage(message: any, transfer?: Transferable[] | StructuredSerializeOptions): void {
    if (this.#state === "terminated") {
      throw new Error("Cannot postMessage() - WorkerLike is terminated.");
    }
    this.channel.port2.postMessage(message, (transfer as StructuredSerializeOptions)?.transfer ?? transfer as Transferable[]);
  }

  /**
   * Terminates the `WorkerLike` instance, closing the ports.
   */
  terminate(): void {
    if (this.#state === "terminated") return;
    this.#state = "terminated";
    this.port.close();
    this.channel.port2.close();
  }

  setInit(init: WorkerLikeInit): Worker {
    const worker = this as unknown as Worker;
    if (init.onmessage) {
      worker.onmessage = init.onmessage;
    }
    if (init.onmessageerror) {
      worker.onmessageerror = init.onmessageerror;
    }
    if (init.onerror) {
      worker.onerror = init.onerror;
    }
    return worker as unknown as Worker;
  }

  /**
   * Creates a `WorkerLike` instance from a provided worker-like object.
   */
  static fromWorker(init: WorkerLikeInit): Worker {
    const worker = new WorkerLike();
    return worker.setInit(init)
  }
}
