import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Preserve the installed Nginx table; normalize browser-sensitive extensions.
export function browserMimeTypes(source) {
  const body = source.replace(/#[^\n]*/g, '').match(/^\s*types\s*\{([\s\S]*)\}\s*$/)?.[1]
  if (!body) throw new Error('Invalid Nginx MIME table')
  const types = new Map()
  for (const entry of body.split(';')) {
    const [mime, ...extensions] = entry.trim().split(/\s+/)
    for (const extension of extensions) types.set(extension, mime)
  }
  for (const [mime, extensions] of [
    ['text/html', 'html htm'], ['text/css', 'css'],
    ['text/javascript', 'js mjs'], ['application/json', 'json map'],
    ['application/wasm', 'wasm'], ['image/svg+xml', 'svg svgz'],
    ['font/woff', 'woff'], ['font/woff2', 'woff2'],
    ['font/ttf', 'ttf'], ['font/otf', 'otf'],
    ['image/webp', 'webp'], ['image/avif', 'avif'],
    ['model/gltf+json', 'gltf'], ['model/gltf-binary', 'glb'],
    ['audio/ogg', 'ogg oga'], ['video/webm', 'webm'],
    ['text/vtt', 'vtt'], ['application/manifest+json', 'webmanifest']
  ]) for (const extension of extensions.split(' ')) types.set(extension, mime)
  return `types {\n${[...types].map(([ext, mime]) => `  ${mime} ${ext};`).join('\n')}\n}\n`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(process.argv[3], browserMimeTypes(readFileSync(process.argv[2], 'utf8')))
}
