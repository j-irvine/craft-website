// Craft's brand colors (Mini Brand Book, as in Craft Apps' src/styles/tokens.css). Fonts are the
// brand's; inside Showit they come from the page's own font files, so nothing is loaded here.

export const CSS = `
:host {
  --cream: #ffe5c8;
  --terracotta: #b64726;
  --chocolate: #352222;
  --forest: #485c3d;
  --sage: #86a37a;
  --burgundy: #762826;
  --font-header: 'KK Topo', 'Epilogue', Georgia, serif;
  --font-sub: 'Trio Grotesk', 'Epilogue', system-ui, sans-serif;
  --font-body: 'Epilogue', system-ui, sans-serif;

  /* Light by default: chips and text for a cream page, cards in deeper cream. */
  --text: var(--chocolate);
  --muted: color-mix(in srgb, var(--chocolate) 70%, var(--cream));
  --card: color-mix(in srgb, var(--chocolate) 7%, var(--cream));
  --card-text: var(--chocolate);
  --heading: var(--terracotta);
  --chip-line: color-mix(in srgb, var(--chocolate) 30%, transparent);

  display: block;
  height: 100%;
  min-height: 420px;
  color: var(--text);
  font-family: var(--font-body);
}
/* data-theme="dark" for the chocolate sections of the site. */
:host([data-theme='dark']) {
  --text: var(--cream);
  --muted: color-mix(in srgb, var(--cream) 75%, var(--chocolate));
  --card: var(--cream);
  --chip-line: color-mix(in srgb, var(--cream) 45%, transparent);
}
* { box-sizing: border-box; }
.fyp { container-type: inline-size; height: 100%; display: flex; flex-direction: column; gap: 14px; position: relative; }
.note { margin: auto; padding: 16px; text-align: center; color: var(--muted); max-width: 32ch; }

.chips {
  display: flex; gap: 8px; flex-wrap: wrap; flex: none;
}
.chip {
  font: 700 12px/1 var(--font-sub); letter-spacing: .08em; text-transform: uppercase;
  color: inherit; background: transparent; border: 1px solid var(--chip-line);
  border-radius: 999px; padding: 10px 14px; cursor: pointer; min-height: 36px;
}
.chip[aria-pressed='true'] { background: var(--forest); border-color: var(--forest); color: var(--cream); }
.chip:focus-visible, button:focus-visible, .track:focus-visible { outline: 2px solid var(--terracotta); outline-offset: 2px; }

.rail { flex: 1; min-height: 0; position: relative; display: flex; align-items: stretch; }
.track {
  flex: 1; display: flex; gap: 16px; overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory; scrollbar-width: none; padding-bottom: 2px;
}
.track::-webkit-scrollbar { display: none; }
.nav {
  position: absolute; top: 40%; z-index: 2; width: 40px; height: 40px; border-radius: 50%;
  border: none; background: var(--forest); color: var(--cream); cursor: pointer;
  display: grid; place-items: center; box-shadow: 0 2px 8px rgb(0 0 0 / .2);
}
.nav svg { width: 20px; height: 20px; }
.prev { left: -12px; } .prev svg { transform: rotate(180deg); }
.next { right: -12px; }
.nav:disabled { opacity: 0; pointer-events: none; }

.card {
  flex: 0 0 260px; scroll-snap-align: start; display: flex; flex-direction: column;
  background: var(--card); color: var(--card-text); border-radius: 4px; overflow: hidden;
}
.photo { flex: 1 1 auto; min-height: 120px; position: relative; background: var(--forest); }
.photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.placeholder { position: absolute; inset: 0; display: grid; place-items: center;
  background: radial-gradient(circle at 30% 20%, var(--sage), var(--forest) 70%); }
.placeholder span { font: 400 72px/1 var(--font-header); color: var(--cream); opacity: .9; }
.body { flex: none; height: 252px; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; }
h3 { margin: 0; font: 400 26px/1.05 var(--font-header); color: var(--heading); }
.years { margin: 0; font: 700 11px/1.2 var(--font-sub); letter-spacing: .08em; text-transform: uppercase; color: var(--forest); }
.tags { list-style: none; margin: 2px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px;
  max-height: 46px; overflow: hidden; }
.tags li { font-size: 11px; line-height: 1; padding: 5px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--sage) 28%, transparent); }
.tags li.on { background: var(--forest); color: var(--cream); }
.cert, .bio { margin: 0; font-size: 13px; line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bio { display: none; }
.more { align-self: flex-start; background: none; border: 0; padding: 2px 0; cursor: pointer;
  font: 12px/1.2 var(--font-body); color: var(--muted); text-decoration: underline; text-underline-offset: 2px; }
.book {
  margin-top: auto; min-height: 44px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--terracotta); color: var(--cream);
  font: 700 12px/1 var(--font-sub); letter-spacing: .08em; text-transform: uppercase;
}
.book:hover { background: var(--burgundy); }

/* "More about": the details take the card, the photo shrinks to a strip. */
.card.open .photo { flex: 0 0 64px; min-height: 64px; }
.card.open .placeholder span { font-size: 36px; }
.card.open .body { flex: 1 1 auto; height: auto; min-height: 0; overflow-y: auto; }
.card.open .tags { max-height: none; }
.card.open .cert, .card.open .bio { display: block; -webkit-line-clamp: unset; }

.toast {
  position: absolute; left: 50%; bottom: 12px; transform: translate(-50%, 20px); opacity: 0;
  background: var(--chocolate); color: var(--cream); padding: 12px 16px; border-radius: 8px;
  font-size: 14px; transition: .25s; pointer-events: none; width: max-content; max-width: 90%; text-align: center;
}
.toast.show { opacity: 1; transform: translate(-50%, 0); }

@container (max-width: 600px) {
  .chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin: 0 -2px; padding: 0 2px; }
  .chips::-webkit-scrollbar { display: none; }
  .chip { flex: none; }
  .card { flex-basis: 78%; }
  .nav { display: none; }
}
@media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
`
