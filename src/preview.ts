// A page that shows the directory in boxes sized like Showit's embed boxes (desktop and phone),
// so the owners can look before anything goes on the live site.

import type { Location } from './instructors'

export function previewPage(location: Location, origin: string, scriptTag?: (location: Location) => string): string {
  const tag = scriptTag ?? ((l: Location) => `<script src="${origin}/find-your-person.js" data-location="${l}"></script>`)
  const other: Location = location === 'park-slope' ? 'uws' : 'park-slope'
  const name = location === 'park-slope' ? 'Park Slope' : 'Upper West Side'
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Find Your Person preview</title>
<style>:root { color-scheme: light; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700&family=Fraunces:opsz,wght@9..144,400&display=swap" rel="stylesheet">
<style>
  /* Stand-ins for the brand fonts, which live on the Showit site. */
  craft-find-your-person { --font-header: Fraunces, Georgia, serif; }
  body { margin: 0; background: #ffe5c8; color: #352222; font-family: Epilogue, system-ui, sans-serif; }
  header, section { max-width: 1100px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  header { padding-block: 24px 8px; }
  h1 { font: 400 32px/1.1 Fraunces, Georgia, serif; color: #b64726; margin: 0 0 8px; }
  p { margin: 0 0 8px; max-width: 70ch; line-height: 1.45; }
  a { color: #485c3d; }
  section { padding-block: 16px; }
  h2 { font: 700 12px/1 Epilogue, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #485c3d; margin: 16px 0 10px; }
  .box { outline: 1px dashed #b6472666; outline-offset: 6px; }
  .desktop { height: 600px; max-width: 1000px; }
  .phone-wrap { width: 360px; max-width: 100%; box-sizing: border-box; border: 10px solid #352222; border-radius: 28px; padding: 16px 16px 20px; background: #ffe5c8; }
  .phone { height: 620px; }
  .phone-note { font-size: 13px; color: #6b5a52; }
  @media (max-width: 760px) { .desktop-section { display: none; } }
</style>
</head><body>
<header>
  <h1>Find Your Person · ${name}</h1>
  <p>A preview of the instructor directory as it would sit on the privates page. The dashed outline is the Showit embed box.${scriptTag ? '' : ` <a href="?location=${other}">Switch studio</a>.`}</p>
</header>
<section class="desktop-section"><h2>Desktop · 1000 × 600 box</h2><div class="box desktop">${tag(location)}</div></section>
<section><h2>Phone · 328 × 620 box</h2><div class="phone-wrap"><div class="box phone">${tag(location)}</div></div>
<p class="phone-note">On a real phone the chips scroll sideways and cards take most of the width.</p></section>
</body></html>`
}
