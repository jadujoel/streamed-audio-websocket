await Bun.$`rm -rf dist`
const scripts = await Array.fromAsync(new Bun.Glob('src/**/*{.ts,.js}').scan())
  .then(values => values.filter(v => !v.includes((".d."))))
const options = {
  root: "src",
  // throw: false,
  splitting: false,
  entrypoints: [
    'src/index.html',
    'src/encoder/index.html',
    'src/decoder/index.html',
    ...scripts
  ],
  sourcemap: 'external' as const,
  minify: true,
  outdir: 'dist',
  naming: {
    asset: "[dir]/asset.[name].[hash].[ext]", // image files mby? not sure
    chunk: "[dir]/[name].[hash].[ext]", // js-files
    entry: "[dir]/[name].[ext]", // html files
  }
}
const output = await Bun.build(options)
options.naming.entry = "[name].[hash].[ext]"
await Bun.build(options)

// for (const out of output.outputs) {
//   const info = {
//     type: out.type,
//     kind: out.kind,
//     name: out.name,
//     hash: out.hash,
//     path: out.path
//   }
//   console.log(out)
// }

const statics = await Array.fromAsync(new Bun.Glob('src/**/*{.wasm,.opus,.mp4,.ico,.wasm.mjs}').scan())
for (const file of statics) {
  await Bun.write(file.replace('src/', 'dist/'), Bun.file(file))
}

console.log({ statics, scripts })
