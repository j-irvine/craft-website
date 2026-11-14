// Writes dist/schedule-preview.html: the class schedule for both studios with today's real classes from
// Arketa inlined, in boxes sized like Showit's embed boxes, so the owners can look before anything goes on
// the live site. Also dist/schedule-artifact.html, the same page as a claude.ai Artifact body.
// Usage: node scripts/preview-schedule.mjs  (FONT_DIR=<studio-app>/brand/fonts/Type for the brand fonts)
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const bundle = async (entry, format) =>
  (await build({ entryPoints: [entry], bundle: true, format, target: 'es2020', write: false, minify: format === 'iife' })).outputFiles[0].text
const widget = await bundle('src/widget/schedule.ts', 'iife')
const { fetchSchedule } = await import(`data:text/javascript;base64,${Buffer.from(await bundle('src/schedule.ts', 'esm')).toString('base64')}`)

const studios = { 'park-slope': 'Park Slope', uws: 'Upper West Side' }
const data = {}
for (const [l, name] of Object.entries(studios)) data[l] = { location: name, classes: await fetchSchedule(l) }
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
const tag = (l) => `<craft-class-schedule data-location="${l}" data-fonts="none" data-json="${attr(JSON.stringify(data[l]))}"></craft-class-schedule>`

const fontDir = process.env.FONT_DIR
const face = (family, weight, file) =>
  `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2'); }`
const fonts = fontDir
  ? `<style>${face('Craft KK Topo', 400, `${fontDir}/KK-Topo/KK-Topo-Regular.woff2`)}\n${face('Craft Trio Grotesk', 700, `${fontDir}/Trio Grotesk/Web/TrioGrotesk-Bold.woff2`)}</style>`
  : ''
const read = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const body = `
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700&display=swap" rel="stylesheet">
${fonts}
<style>
  :root { color-scheme: light; --bg: #fcf3e8; --fg: #352222; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: Epilogue, system-ui, sans-serif; }
  header, section { max-width: 1100px; margin: 0 auto; padding-left: 16px; padding-right: 16px; }
  header { padding-block: 28px 4px; }
  h1 { font: 400 36px/1.05 'Craft KK Topo', Epilogue, sans-serif; margin: 0 0 10px; color: #b64726; }
  p { margin: 0 0 10px; max-width: 70ch; line-height: 1.45; }
  .label, .studios button { font: 700 11px/1 'Craft Trio Grotesk', Epilogue, sans-serif; letter-spacing: .14em; text-transform: uppercase; }
  .studios { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; }
  .studios button { color: inherit; background: transparent; border: 1px solid currentColor; padding: 10px 12px; cursor: pointer; }
  .studios button[aria-pressed="true"] { background: var(--fg); color: var(--bg); }
  section { padding-block: 18px; }
  .label { margin: 8px 0 14px; opacity: .8; }
  .box { outline: 1px dashed rgba(53,34,34,.45); outline-offset: 6px; }
  .desktop { height: 640px; max-width: 1000px; }
  .phone-wrap { width: 360px; max-width: 100%; box-sizing: border-box; border: 10px solid #1d1313; border-radius: 28px; padding: 18px 16px 22px; }
  .phone { height: 680px; }
  [data-studio]:not(.on) { display: none; }
  @media (max-width: 760px) { .desktop-section { display: none; } }
</style>
<header>
  <h1>Group class schedule</h1>
  <p>Our own schedule section, in place of Arketa's, with the real classes as of ${read}. One day at a time, so the page stays short. The dashed outline is the Showit embed box. Book opens that class on our booking site, where booking is real, so stop before paying.</p>
  <div class="studios" role="group" aria-label="Studio">
    ${Object.entries(studios).map(([l, n], i) => `<button type="button" data-pick="${l}" aria-pressed="${i === 0}">${n}</button>`).join('')}
  </div>
</header>
${Object.keys(studios).map((l, i) => `<div data-studio="${l}"${i === 0 ? ' class="on"' : ''}>
<section class="desktop-section"><p class="label">Desktop · 1000 × 640 box</p><div class="box desktop">${tag(l)}</div></section>
<section><p class="label">Phone · 320 × 680 box</p><div class="phone-wrap"><div class="box phone">${tag(l)}</div></div></section>
</div>`).join('\n')}
<script>
  document.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-pick]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    document.querySelectorAll('[data-studio]').forEach((s) => s.classList.toggle('on', s.dataset.studio === b.dataset.pick))
  }))
</script>
<script>${widget.replace(/<\/script/gi, '<\\/script')}</script>`

mkdirSync('dist', { recursive: true })
writeFileSync('dist/schedule-preview.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Class schedule preview</title></head><body>${body}</body></html>`)
writeFileSync('dist/schedule-artifact.html', `<title>Class schedule preview</title>\n${body}`)
console.log('dist/schedule-preview.html, dist/schedule-artifact.html')
