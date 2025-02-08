// This file should be used when the browser doesnt support AudioData / AudioEncoder instead
// of the regular worker
// for some reason worker halts if we install the WebCodecsPolyfill

import LibAV from 'libav.js';
import { load } from "libavjs-webcodecs-polyfill";
import { WorkerLike, type WorkerLikeInit } from './worker-like';

async function installWebCodecs() {
  if (globalThis.AudioEncoder === undefined) {
    const libavOptions = {
      wasmurl: "/libav-6.5.7.1-default.wasm.wasm",
      toImport: "/libav-6.5.7.1-default.wasm.mjs",
      noworker: false,
      nothreads: true,
    }
    console.log("[shim] install Web Codecs", libavOptions)
    Object.assign(LibAV, libavOptions)
    await load({
      LibAV,
      polyfill: true,
      libavOptions
    })
    console.log("[shim] install done")
  }
}

export async function SafariWorkerAsync(init: WorkerLikeInit): Promise<Worker> {
  await installWebCodecs()
  return WorkerLike.fromWorker(init)
}

export function SafariWorkerFromInitSync(init: WorkerLikeInit): Worker {
  const promise = installWebCodecs()
  return WorkerLike.fromWorker({
    onmessage: (ev) => {
      promise.then(init.onmessage?.(ev))
    },
    onerror: (ev) => {
      promise.then(init.onerror?.(ev))
    },
    onmessageerror(ev) {
      promise.then(init.onmessage?.(ev))
    },
  })
}

export function SafariWorkerFromInitCallback(init: (scope: WorkerLike) => WorkerLikeInit): Worker {
  const worker = new WorkerLike()
  const promise = installWebCodecs().then(() => {
    const work = init(worker)
    return work
  })
  worker.setInit({
    onmessage: (ev) => {
      promise.then(init => {
        init.onmessage?.(ev)
    })
    },
    onerror: (ev) => {
      promise.then(init => init.onerror?.(ev))
    },
    onmessageerror(ev) {
      promise.then(init => init.onmessage?.(ev))
    },
  }) as unknown as WorkerLike
  return worker as unknown as Worker
}
