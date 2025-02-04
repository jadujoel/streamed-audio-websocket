import home from "./src/index.html"
import encoder from "./src/encoder/index.html"
import decoder from "./src/decoder/index.html"

const production = process.argv.includes("--production")
const hostname = production ? "0.0.0.0" : "127.0.0.1"

let longest = 0
const server = Bun.serve({
  hostname,
  cert: production ? Bun.file("./localhost.crt") : undefined,
  key: production ? Bun.file("./localhost.key") : undefined,
  development: !production,
  static: {
    "/": home,
    "/encoder": encoder,
    "/decoder": decoder,
  },
  async fetch(request, server) {
    const pathname = new URL(request.url).pathname
    console.log("request", request.method, request.url, pathname)


    if (pathname.endsWith(".js")) {
      const result = await Bun.build({
        entrypoints: [`src${pathname}`],
        minify: true,
      })
      return new Response(result.outputs[0], {
        headers: {
          'Content-Type': 'application/javascript'
        }
      });
    }
    if (request.headers.get("upgrade")) {
      if (!server.upgrade(request)) {
        return new Response("Upgrade failed", { status: 400 });
      }
    }
    return new Response(Bun.file(`src${pathname}`))
  },
  websocket: {
    open(ws) {
      ws.subscribe("stream")
    },
    close(ws, code, reason) {
      console.log("ws closed", {code, reason})
    },
    message(ws, message) {
      ws.publish("stream", message)
      longest = Math.max(message.length, longest)
      // console.log("ws message", message.length, message)
    },
  }
})

console.log(`Listening on ${server.url}`)
