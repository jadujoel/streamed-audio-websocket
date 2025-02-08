// This file should be used when the browser doesnt support AudioData / AudioEncoder instead
// of the regular worker
// for some reason worker halts if we install the WebCodecsPolyfill
import { SafariWorkerFromInitCallback } from '../safari-web-codec-worker';
import { init } from './worker';
export function SafariDecodeWorker() {
  return SafariWorkerFromInitCallback(init)
}
