export async function serve() {
  const production = process.argv.includes("--production")
  const hostname = production ? "0.0.0.0" : "127.0.0.1"

  await Bun.$`bun build.ts`

  const server = Bun.serve({
    hostname,
    cert: production ? Bun.file("./localhost.crt") : undefined,
    key: production ? Bun.file("./localhost.key") : undefined,
    development: !production,
    async fetch(request) {
      const url = new URL(request.url)
      let pathname = url.pathname
      console.log("[serve]", url.href, request.destination, request.referrer)
      if (pathname.endsWith("/")) {
        pathname += "index.html"
      } else if (!pathname.includes(".")) {
        pathname += "/index.html"
      }
      if (request.headers.get("upgrade")) {
        if (!server.upgrade(request)) {
          return new Response("Upgrade failed", { status: 400 });
        }
      }
      return new Response(Bun.file(`dist${pathname}`))
    },
    websocket: {
      open(ws) {
        console.log("[ws] opened")
        ws.subscribe("stream")
      },
      close(ws, code, reason) {
        console.log("ws closed", {code, reason})
      },
      message(ws, message) {
        ws.publish("stream", message)
      },
    }
  })

  console.log(`Listening on ${server.url}`)

}

if (import.meta.main) {
  await serve()
}
