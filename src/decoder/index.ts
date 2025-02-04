import { Decoder } from './decoder'

log("Decoder.ts")

function log(...args: any[]) {
  console.log(...args)
}

main()
async function main() {
  const sampleRate = 48_000
  const context = new AudioContext({ sampleRate, latencyHint: "playback" })
  await Decoder.addModule(context, window.location.pathname + "/processor.js");
  const params = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`)
  const decoder = Decoder.create(context, {
    workerUrl: window.location.pathname + "/worker.js",
    websocketUrl: params.get("socket") ?? undefined
  });
  decoder.node.connect(context.destination)
  return
}

function button({ text, onclick }: { text?: string, onclick?: (this: GlobalEventHandlers, ev: MouseEvent) => void }) {
  const btn = document.createElement("button")
  btn.innerText = text ?? ""
  btn.style.cssText = "height: 200px; width: 600px;background-color: #202020;color:white"
  btn.onclick = onclick ?? null
  document.body.appendChild(btn)
  return btn
}
