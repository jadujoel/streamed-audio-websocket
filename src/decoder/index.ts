import { Decoder } from './decoder'

log("Decoder.ts")

function log(...args: any[]) {
  console.log(...args)
}

main()
async function main(context?: AudioContext) {
  const sampleRate = 48_000
  context ??= new AudioContext({ sampleRate, latencyHint: "playback" })
  console.log("Main", context.state)
  if (context.state !== "running") {
    const html = document.body.innerHTML
    document.body.innerHTML = ""
    const btn = button({
      text: "Start",
      onclick: async () => {
        await context.resume()
        main(context)
        btn.remove()
        document.body.innerHTML = html
      }
    })
    return
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

function button({ text, onclick }: { text?: string, onclick?: (this: GlobalEventHandlers, ev: MouseEvent) => void }) {
  const btn = document.createElement("button")
  btn.innerText = text ?? ""
  btn.style.cssText = "height: 200px; width: 600px;background-color: #202020;color:white"
  btn.onclick = onclick ?? null
  document.body.appendChild(btn)
  return btn
}
