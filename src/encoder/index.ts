import { start } from 'can-start-audio-context'
import { Encoder } from "./encoder"

main()
async function main() {
  document.body.innerText = "Click To Start"
  const context = await start(undefined, { sampleRate: 48000, latencyHint: "playback" })
  document.body.innerText = ""
  await Encoder.addModule(context) // , window.location.pathname + "/processor.js")
  const src = context.createBufferSource()
  await fetchAudio(context, "/48kb.2ch.366384529314489.mp4")
    .then((v) => src.buffer = v)
  let bitrate = 48_000

  const gain = context.createGain()
  const params = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`)

  const encoder = Encoder.create(context, {
    bitratePerChannel: bitrate,
    websocketUrl: getWebSocketUrl(),
    workerUrl: window.location.pathname + "/worker.js"
  })
  src.connect(gain).connect(encoder.node).connect(context.destination)
  encoder.start()

  function getWebSocketUrl() {
    const socketParam = params.get("socket")
    if (socketParam === null) {
      return undefined
    }
    return decodeURIComponent(socketParam).replaceAll("\"", "")
  }
  const fileButton = button({
    text: "Start File",
    onclick: () => {
      try {
        src.start()
      } catch {}

      fileButton.innerText = "Stop File"
      fileButton.onclick = () => {
        try {
          src.stop()
        } catch {}
        fileButton.remove()
      }
    }
  })

  const talkButton = button({
    text: "Talk",
    onclick: async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          sampleRate: 48_000,
          backgroundBlur: false,
        },
        video: false,
      })
      const source = context.createMediaStreamSource(stream);
      source.connect(gain)
      talkButton.innerText = "Stop Talking"
      talkButton.onclick = () => {
        source.disconnect()
        talkButton.remove()
      }
    }
  })

  const streamButton = button({
    text: "Stop Stream",
    onclick: () => {
      encoder.stop()
      streamButton.remove()
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

async function fetchAudio(context: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url)
  return await context.decodeAudioData(await response.arrayBuffer())
}
