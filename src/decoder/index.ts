import { canStart } from '../tools'
import { Decoder } from './decoder'

log("Decoder.ts")

function log(...args: any[]) {
  console.log(...args)
}

main()
async function main() {
  const status = document.createElement("h2")
  status.innerText = "Click anywhere to start"
  document.body.appendChild(status)
  await canStart()
  status.innerText = "Started"

  const sampleRate = 48_000

  const context = new AudioContext({ sampleRate, latencyHint: "playback" })
  if (context.state !== "running") {
    await context.resume()
  }
  await Decoder.addModule(context, window.location.pathname + "/processor.js");
  const params = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`)
  const decoder = Decoder.create(context, {
    workerUrl: window.location.pathname + "/worker.js",
    websocketUrl: getWebSocketUrl()
  });
  decoder.node.connect(context.destination)
  function getWebSocketUrl() {
    const socketParam = params.get("socket")
    if (socketParam === null) {
      return undefined
    }
    return decodeURIComponent(socketParam).replaceAll("\"", "")
  }
  return
}
