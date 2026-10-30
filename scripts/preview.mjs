// Writes dist/preview.html: the preview page with the widget and made-up instructors inlined,
// so it opens on its own with no Worker or sheet. Usage: npm run preview [-- park-slope|uws]
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const location = process.argv[2] ?? 'park-slope'
// PANEL=1: "Book with" opens Arketa's booking for the instructor over the page.
const panel = Boolean(process.env.PANEL)
const bundle = async (entry, format) =>
  (await build({ entryPoints: [entry], bundle: true, format, target: 'es2020', write: false, minify: format === 'iife' })).outputFiles[0].text
const widget = await bundle('src/widget/widget.ts', 'iife')
const previewModule = await bundle('src/preview.ts', 'esm')
const { previewPage } = await import(`data:text/javascript;base64,${Buffer.from(previewModule).toString('base64')}`)
const { arketaBookingUrl, arketaSessions } = await import(`data:text/javascript;base64,${Buffer.from(await bundle('src/instructors.ts', 'esm')).toString('base64')}`)

const sample = JSON.parse(readFileSync('preview/sample.json', 'utf8'))
const dataFor = (l) => ({
  ...sample,
  location: l === 'uws' ? 'Upper West Side' : 'Park Slope',
  booking: arketaBookingUrl(l, null),
  sessions: arketaSessions(l, null),
  instructors: sample.instructors
    .filter((i) => i.locations.includes(l))
    .map(({ locations, arketaHost, ...i }) => ({ ...i, sessions: arketaHost ? arketaSessions(l, arketaHost) : null })),
})
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
// The widget mounts after its own <script>, so inline copies need it as a separate element.
const placeholder = `data:image/jpeg;base64,${readFileSync('assets/placeholder.jpg').toString('base64')}`
const tag = (l) => `<craft-find-your-person data-location="${l}"${panel ? ' data-booking="panel"' : ''} data-fonts="none" data-placeholder="${placeholder}" data-json="${attr(JSON.stringify(dataFor(l)))}"></craft-find-your-person>`
// The brand fonts, inlined from a Craft Apps checkout (FONT_DIR=<studio-app>/brand/fonts/Type).
// Without it the preview falls back to Epilogue.
const fontDir = process.env.FONT_DIR
const face = (family, weight, file) =>
  `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2'); }`
const head = fontDir
  ? `<style>${face('Craft KK Topo', 400, `${fontDir}/KK-Topo/KK-Topo-Regular.woff2`)}\n${face('Craft Trio Grotesk', 700, `${fontDir}/Trio Grotesk/Web/TrioGrotesk-Bold.woff2`)}</style>`
  : ''
let html = previewPage(location, '', tag, head, panel)
html = html.replace('</body>', () => `<script>${widget.replace(/<\/script/gi, '<\\/script')}</script></body>`)
mkdirSync('dist', { recursive: true })
const suffix = panel ? '-panel' : ''
writeFileSync(`dist/preview-${location}${suffix}.html`, html)
console.log(`dist/preview-${location}${suffix}.html`)

// The same page as a claude.ai Artifact body (it supplies the document skeleton itself).
const artifact = html
  .replace(/<!doctype html>\s*<html[^>]*><head>/i, '<meta name="claude:viewport-fit-sides" content="cover">')
  .replace(/<meta charset="utf-8"><meta name="viewport"[^>]*>/, '')
  .replace('</head><body>', '')
  .replace('</body></html>', '')
writeFileSync(`dist/artifact-${location}${suffix}.html`, artifact)
