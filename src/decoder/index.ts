import { Decoder } from './decoder'
import { start } from 'can-start-audio-context'
main()
async function main() {
  const sampleRate = 48_000

  const status = StatusDisplay()
  status.update("Click To Start Audio Context")
  const context = await start(new AudioContext({ sampleRate, latencyHint: "playback" }))

  status.update("Adding Module")
  await Decoder.addModule(context);

  status.update("Creating Decoder")
  const decoder = Decoder.create(context, {
    websocketUrl: getWebSocketUrl()
  });
  decoder.node.connect(context.destination)

  status.update("Done")
  return
}

function StatusDisplay() {
  const status = document.createElement("h2")
  status.innerText = "Click anywhere to start"
  document.body.appendChild(status)
  return {
    update(newStatus: string) {
      status.innerText = newStatus
    }
  }
}

function getWebSocketUrl() {
  const params = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`)
  const socketParam = params.get("socket")
  if (socketParam === null) {
    return undefined
  }
  return decodeURIComponent(socketParam).replaceAll("\"", "")
}
