import { Encoder } from "./encoder"
console.log("encoder.ts")

main()
async function main() {
  const context = new AudioContext({ sampleRate: 48000, latencyHint: "playback" })
  await Encoder.addModule(context, window.location.pathname + "/processor.js")
  const src = context.createBufferSource()
  src.buffer = await fetchAudio(context, "../48kb.2ch.366384529314489.opus")
  let bitrate = 48_000
  const bitrateEl = selector({
    label: "Bitrate",
    alternatives: ["12b", "24kb", "48kb", "96kb"],
    selected: 2,
    onchange(index) {
      bitrate = [12_000, 24_000, 48_000, 96_000][index]
      console.log(`Selected index ${index} with bitrate ${bitrate}`)
    }
  })

  const params = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`)

  function getWebSocketUrl() {
    const socketParam = params.get("socket")
    if (socketParam === null) {
      return undefined
    }
    return decodeURIComponent(socketParam).replaceAll("\"", "")
  }

  const initEl = button({
    text: "Init",
    async onclick() {
      bitrateEl.remove()
      initEl.remove()
      const encoder = Encoder.create(context, {
        bitratePerChannel: bitrate,
        websocketUrl: getWebSocketUrl(),
        workerUrl: window.location.pathname + "/worker.js"
      })
      src.connect(encoder.node).connect(context.destination)

      button({
        text: "Start",
        onclick: async () => {
          encoder.start()
          try {
            src.start()
          } catch {}
        }
      })
      button({
        text: "Stop",
        onclick: () => {
          encoder.stop()
        }
      })
    }
  })
}

function button({ text, onclick }: { text?: string, onclick?: (this: GlobalEventHandlers, ev: MouseEvent) => void }): HTMLButtonElement {
  const btn = document.createElement("button")
  btn.innerText = text ?? ""
  btn.style.cssText = "height: 200px; width: 600px;background-color: #202020;color:white"
  btn.onclick = onclick ?? null
  document.body.appendChild(btn)
  return btn
}

function selector({label, alternatives, selected, onchange}: { label?: string, selected: number, alternatives: string[], onchange?: (index: number) => void }) {
  const div = document.createElement("div")
  const header = document.createElement("H3")
  header.innerText = label ?? ""
  const select = document.createElement("select")
  for (let i = 0; i < alternatives.length; i++) {
    const option = document.createElement("option")
    option.value = option.innerText = alternatives[i].toString()
    select.appendChild(option)
    if (i === selected) {
      option.selected = true
    }
  }
  select.onchange = () => {
    onchange?.(select.selectedIndex)
  }
  div.append(header, select)
  document.body.appendChild(div)
  return div
}

function slider({ text, oninput }: { text?: string, oninput?: (this: GlobalEventHandlers, ev: Event) => void }): HTMLDivElement {
  const div = document.createElement("div")
  const label = document.createElement("H3")
  label.innerText = text ?? ""
  const input = document.createElement("input")
  input.oninput = oninput ?? null
  div.append(label, input)
  return document.body.appendChild(div)
}

async function fetchAudio(context: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url)
  return await context.decodeAudioData(await response.arrayBuffer())
}
