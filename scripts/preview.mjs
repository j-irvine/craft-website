// Writes dist/preview.html: the preview page with the widget and made-up instructors inlined,
// so it opens on its own with no Worker or sheet. Usage: npm run preview [-- park-slope|uws]
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const location = process.argv[2] ?? 'park-slope'
const bundle = async (entry, format) =>
  (await build({ entryPoints: [entry], bundle: true, format, target: 'es2020', write: false, minify: format === 'iife' })).outputFiles[0].text
const widget = await bundle('src/widget/widget.ts', 'iife')
const previewModule = await bundle('src/preview.ts', 'esm')
const { previewPage } = await import(`data:text/javascript;base64,${Buffer.from(previewModule).toString('base64')}`)

const sample = JSON.parse(readFileSync('preview/sample.json', 'utf8'))
const dataFor = (l) => ({
  ...sample,
  location: l === 'uws' ? 'Upper West Side' : 'Park Slope',
  instructors: sample.instructors.filter((i) => i.locations.includes(l)).map(({ locations, ...i }) => i),
})
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
// The widget mounts after its own <script>, so inline copies need it as a separate element.
const tag = (l) => `<craft-find-your-person data-location="${l}" data-json="${attr(JSON.stringify(dataFor(l)))}"></craft-find-your-person>`
let html = previewPage(location, '', tag)
html = html.replace('</body>', `<script>${widget.replace(/<\/script/gi, '<\\/script')}</script></body>`)
mkdirSync('dist', { recursive: true })
writeFileSync(`dist/preview-${location}.html`, html)
console.log(`dist/preview-${location}.html`)

// The same page as a claude.ai Artifact body (it supplies the document skeleton itself).
const artifact = html
  .replace(/<!doctype html>\s*<html[^>]*><head>/i, '<meta name="claude:viewport-fit-sides" content="cover">')
  .replace(/<meta charset="utf-8"><meta name="viewport"[^>]*>/, '')
  .replace('</head><body>', '')
  .replace('</body></html>', '')
writeFileSync(`dist/artifact-${location}.html`, artifact)
