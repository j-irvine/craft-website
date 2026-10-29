// A page that shows the directory in boxes sized like Showit's embed boxes (desktop and phone),
// on each of the site's section colors, so the owners can look before anything goes on the live site.

import type { Location } from './instructors'

const THEMES = [
  { key: 'cream', label: 'Cream', bg: '#ffe5c8', fg: '#352222', attr: '' },
  { key: 'chocolate', label: 'Chocolate', bg: '#352222', fg: '#ffe5c8', attr: 'chocolate' },
  { key: 'forest', label: 'Forest', bg: '#485c3d', fg: '#ffe5c8', attr: 'forest' },
]

export function previewPage(location: Location, origin: string, scriptTag?: (location: Location) => string, head = ''): string {
  const tag = scriptTag ?? ((l: Location) => `<script src="${origin}/find-your-person.js" data-location="${l}"></script>`)
  const other: Location = location === 'park-slope' ? 'uws' : 'park-slope'
  const name = location === 'park-slope' ? 'Park Slope' : 'Upper West Side'
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Find Your Person preview</title>
<style>:root { color-scheme: light; }</style>
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700&display=swap" rel="stylesheet">
${head}
<style>
  :root { --bg: #ffe5c8; --fg: #352222; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: Epilogue, system-ui, sans-serif; transition: background .2s; }
  header, section { max-width: 1100px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  header { padding-block: 28px 4px; }
  h1 { font: 400 36px/1.05 'Craft KK Topo', 'KK Topo', Epilogue, sans-serif; margin: 0 0 10px; text-wrap: balance; }
  p { margin: 0 0 10px; max-width: 68ch; line-height: 1.45; }
  a { color: inherit; }
  .label, .themes button { font: 700 11px/1 'Craft Trio Grotesk', 'Trio Grotesk', Epilogue, sans-serif; letter-spacing: .14em; text-transform: uppercase; }
  .themes { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 14px 0 0; }
  .themes button { color: inherit; background: transparent; border: 1px solid currentColor; padding: 10px 12px; cursor: pointer; }
  .themes button[aria-pressed="true"] { background: var(--fg); color: var(--bg); }
  section { padding-block: 18px; }
  .label { margin: 8px 0 12px; opacity: .8; }
  .box { outline: 1px dashed color-mix(in srgb, var(--fg) 45%, transparent); outline-offset: 6px; }
  .desktop { height: 600px; max-width: 1000px; }
  .phone-wrap { width: 360px; max-width: 100%; box-sizing: border-box; border: 10px solid #1d1313; border-radius: 28px; padding: 18px 16px 22px; }
  .phone { height: 620px; }
  .calendar { height: 360px; max-width: 1000px; display: grid; place-items: center; border: 1px dashed color-mix(in srgb, var(--fg) 45%, transparent); opacity: .7; }
  @media (max-width: 760px) { .desktop-section { display: none; } }
</style>
</head><body>
<header>
  <h1>Find Your Person · ${name}</h1>
  <p>The instructor directory as it would sit on the privates page, with made-up instructors. The dashed outline is the Showit embed box.${scriptTag ? '' : ` <a href="?location=${other}">Switch studio</a>.`}</p>
  <div class="themes" role="group" aria-label="Section color">
    <span class="label" style="margin:0 6px 0 0">Section color</span>
    ${THEMES.map((t, i) => `<button type="button" data-theme="${t.attr}" data-bg="${t.bg}" data-fg="${t.fg}" aria-pressed="${i === 0}">${t.label}</button>`).join('')}
  </div>
</header>
<section class="desktop-section"><p class="label">Desktop · 1000 × 600 box</p><div class="box desktop">${tag(location)}</div></section>
<section><p class="label">The page's Arketa booking calendar sits here</p><div class="calendar" data-craft-booking>Booking calendar</div></section>
<section><p class="label">Phone · 328 × 620 box</p><div class="phone-wrap"><div class="box phone">${tag(location)}</div></div></section>
<script>
  document.querySelectorAll('.themes button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.themes button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    document.documentElement.style.setProperty('--bg', b.dataset.bg)
    document.documentElement.style.setProperty('--fg', b.dataset.fg)
    document.querySelectorAll('craft-find-your-person').forEach((w) =>
      b.dataset.theme ? w.setAttribute('data-theme', b.dataset.theme) : w.removeAttribute('data-theme'))
  }))
</script>
</body></html>`
}
