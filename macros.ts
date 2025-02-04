export function version(): string | never {
  console.log("[macro] version")
  return Bun.file("package.json").json()
    .then(json => json.version) as unknown as string
}

export function text(file: string): string | never {
  console.log("[macro] text")
  return Bun.file(file).text() as unknown as string
}

export function json<T = Record<string, unknown>>(file: string): T | never {
  console.log("[macro] json")
  return Bun.file(file).json() as unknown as T
}

export function minified(file: string): string | never {
  return Bun.$`bun build ${file} --minify`.text() as unknown as string
}

export function unminified(file: string): string | never {
  return Bun.$`bun build ${file}`.text() as unknown as string
}
