// Craft's Mini Brand Book (Dec 2024; brand/ in Craft Apps): KK Topo headers, Trio Grotesk Bold
// sub-headers and CTAs (wide-tracked capitals, square "BOOK NOW" button), Epilogue body.
// Colors come in the book's "optimal combinations" for the section the embed sits on (data-theme).

export const CSS = `
:host {
  --mint: #c0caaf;
  --forest: #485c3d;
  --terracotta: #b64726;
  --chocolate: #352222;
  --cream: #ffe5c8;
  --sage: #86a37a;
  --burgundy: #762826;
  --peach: #e59d6d;
  --font-header: 'Craft KK Topo', 'KK Topo', 'Epilogue', system-ui, sans-serif;
  --font-sub: 'Craft Trio Grotesk', 'Trio Grotesk', 'Epilogue', system-ui, sans-serif;
  --font-body: 'Epilogue', system-ui, sans-serif;

  /* Cream section (default: the privates pages' background, #fcf3e8; owners, 30 Oct 2026): chocolate text,
     cards in the brand cream, a shade deeper than the page, and a chocolate "Any availability" card. */
  --text: var(--chocolate);
  --muted: color-mix(in srgb, var(--chocolate) 70%, var(--cream));
  --chip-line: color-mix(in srgb, var(--chocolate) 45%, transparent);
  --chip-on-bg: var(--chocolate);
  --chip-on-text: var(--cream);
  --card: var(--cream);
  --card-text: var(--chocolate);
  --name: var(--terracotta);
  --years: var(--forest);
  --tag: var(--mint);
  --tag-on: var(--forest);
  --cta: var(--chocolate);
  --cta-hover: var(--terracotta);
  --nav: var(--chocolate);
  --nav-text: var(--cream);
  --photo-bg: var(--forest);
  --any-bg: var(--chocolate);
  --any-text: var(--cream);
  --any-title: var(--cream);
  --any-cta: var(--cream);
  --any-cta-text: var(--chocolate);

  display: block;
  height: 100%;
  min-height: 420px;
  color: var(--text);
  font-family: var(--font-body);
}
/* Chocolate section: cream text, cream cards, a cream "Any availability" card. */
:host([data-theme='chocolate']) {
  --text: var(--cream);
  --muted: color-mix(in srgb, var(--cream) 72%, var(--chocolate));
  --chip-line: color-mix(in srgb, var(--cream) 55%, transparent);
  --chip-on-bg: var(--cream);
  --chip-on-text: var(--chocolate);
  --any-bg: var(--cream);
  --any-text: var(--chocolate);
  --any-title: var(--terracotta);
  --any-cta: var(--chocolate);
  --any-cta-text: var(--cream);
}
/* Forest section: cream text, cream cards, mint highlights. */
:host([data-theme='forest']) {
  --text: var(--cream);
  --chip-line: color-mix(in srgb, var(--cream) 55%, transparent);
  --card: var(--cream);
  --muted: color-mix(in srgb, var(--cream) 75%, var(--forest));
  --chip-on-bg: var(--mint);
  --chip-on-text: var(--forest);
  --any-bg: var(--chocolate);
  --any-text: var(--cream);
  --any-title: var(--cream);
  --any-cta: var(--cream);
  --any-cta-text: var(--chocolate);
}
* { box-sizing: border-box; }
.fyp { container-type: inline-size; height: 100%; display: flex; flex-direction: column; gap: 16px; position: relative; }
.note { margin: auto; padding: 16px; text-align: center; color: var(--muted); max-width: 32ch; line-height: 1.45; }

.filters { flex: none; display: flex; flex-direction: column; gap: 8px; }
/* Says what the chips are (owners, 30 Oct 2026: "All" then "Beginners" didn't read as the instructors' focus),
   and, once one is picked, how many instructors it leaves. */
.filter-label { margin: 0; height: 15px; display: flex; align-items: baseline; gap: 12px; font: 700 10px/15px var(--font-sub); letter-spacing: .14em; text-transform: uppercase; }
.filter-label .count { font: 12px/15px var(--font-body); letter-spacing: 0; text-transform: none; color: var(--muted); }
.chips { display: flex; gap: 8px; flex-wrap: wrap; flex: none; }
.chip {
  font: 700 10px/1 var(--font-sub); letter-spacing: .12em; text-transform: uppercase;
  color: inherit; background: transparent; border: 1px solid var(--chip-line);
  border-radius: 0; padding: 10px 11px; cursor: pointer; min-height: 36px;
}
.chip:hover { border-color: currentColor; }
.chip[aria-pressed='true'] { background: var(--chip-on-bg); border-color: var(--chip-on-bg); color: var(--chip-on-text); }
.chip:focus-visible, button:focus-visible, .track:focus-visible { outline: 2px solid var(--peach); outline-offset: 2px; }

.rail { flex: 1; min-height: 0; position: relative; display: flex; align-items: stretch; }
.track {
  flex: 1; display: flex; gap: 16px; overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory; scrollbar-width: none;
}
.track::-webkit-scrollbar { display: none; }
.nav {
  position: absolute; top: calc(50% - 22px); z-index: 2; width: 44px; height: 44px; border-radius: 0;
  border: none; background: var(--nav); color: var(--nav-text); cursor: pointer;
  display: grid; place-items: center;
}
.nav svg { width: 20px; height: 20px; }
.prev { left: 0; } .prev svg { transform: rotate(180deg); }
.next { right: 0; }
.nav:disabled { opacity: 0; pointer-events: none; }

.card {
  flex: 0 0 264px; scroll-snap-align: start; display: flex; flex-direction: column;
  background: var(--card); color: var(--card-text); border-radius: 0; overflow: hidden;
}
/* Cards the filter leaves out stay in the row, hidden, so card heights can count them (fitBodies). */
.card.out { display: none; }
.measuring .card.out { display: flex; }
.photo { flex: 1 1 auto; min-height: 120px; position: relative; background: var(--photo-bg); }
.photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 25%; }
/* The socks shot: keep the socks in view however the card crops it. */
.photo img.placeholder { object-position: 60% 4%; }
/* Every closed card's body is one height, so photos and names line up and nothing scrolls inside it:
   up to 3 lines of tags, then "+N more" (owners, Oct 30: cards sized to all their tags looked odd).
   The height is the fullest card's (--body-h, set by fitBodies), so no card has much space above its button. */
.body { flex: none; height: var(--body-h, 268px); padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 6px; }
h3 { margin: 0; font: 400 28px/1 var(--font-header); color: var(--name); }
.years { margin: 0; font: 700 10px/1.2 var(--font-sub); letter-spacing: .14em; text-transform: uppercase; color: var(--years); }
.tags { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; max-height: 74px; overflow: hidden; }
.tags li { font: 12px/1 var(--font-body); padding: 5px 7px; background: var(--tag); color: var(--chocolate); }
.tags li[hidden] { display: none; }
.tags li.on { background: var(--tag-on); color: var(--cream); }
.tags li.tags-toggle { padding: 0; background: none; }
.tags-toggle button { font: 12px/1 var(--font-body); padding: 4px 6px; border: 1px solid currentColor; background: none;
  color: var(--card-text); cursor: pointer; }
.tags-toggle button:hover { background: var(--tag); }
/* Bio and certification only show under "More about". */
.bio { margin: 0; font: 13px/1.4 var(--font-body); display: none; }
.cert { display: none; }
.cert p { margin: 0; font: 13px/1.4 var(--font-body); }
.cert .label { margin: 4px 0 2px; font: 700 10px/1.2 var(--font-sub); letter-spacing: .14em; text-transform: uppercase; color: var(--years); }
.more { align-self: flex-start; background: none; border: 0; padding: 2px 0; cursor: pointer; color: inherit; opacity: .75;
  font: 12px/1.2 var(--font-body); text-decoration: underline; text-underline-offset: 3px; }
.more:hover { opacity: 1; }
.book {
  margin-top: auto; min-height: 44px; border: 0; border-radius: 0; cursor: pointer;
  background: var(--cta); color: var(--cream); padding: 6px 12px;
  font: 700 11px/1.25 var(--font-sub); letter-spacing: .1em; text-transform: uppercase;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
/* A long name wraps onto a second line, centred, instead of running out of the button. */
.book span { min-width: 0; text-align: center; text-wrap: balance; overflow-wrap: anywhere; }
.book svg { flex: none; width: 14px; height: 14px; }
.book:hover { background: var(--cta-hover); }

/* "More about" and "+N more": the details push the photo up, down to a strip, and the button stays right
   under them (owners, Oct 30: no gap). Only a card with more than even that holds scrolls. */
.card.open .photo, .card.all-tags .photo { flex: 1 1 64px; min-height: 64px; }
.card.open .body, .card.all-tags .body { flex: 0 1 auto; height: auto; min-height: 0; overflow-y: auto; }
.card.open .book, .card.all-tags .book { margin-top: 10px; }
.card.open .tags, .card.all-tags .tags { max-height: none; }
.card.open .cert, .card.open .bio { display: block; }
/* "Any availability": the first card, so it reads as the main way in. Cream on the chocolate section and
   chocolate on the cream one (owners, Oct 30); chocolate on forest. */
.card.any { background: var(--any-bg); color: var(--any-text); }
.card.any .body { flex: 1 1 auto; height: auto; justify-content: center; gap: 12px; padding: 24px 22px; }
.card.any h3 { color: var(--any-title); }
.card.any .bio { display: block; font-size: 15px; }
.card.any .book { margin-top: 8px; background: var(--any-cta); color: var(--any-cta-text); }
.card.any .book:hover { background: var(--terracotta); color: var(--cream); }

.toast {
  position: fixed; z-index: 2147483000; left: 50%; bottom: max(20px, env(safe-area-inset-bottom, 0px)); transform: translate(-50%, 20px); opacity: 0;
  background: var(--forest); color: var(--cream); padding: 12px 16px;
  font: 14px/1.35 var(--font-body); transition: .25s; pointer-events: none; width: max-content; max-width: 90%; text-align: center;
}
.toast.show { opacity: 1; transform: translate(-50%, 0); }

@container (max-width: 600px) {
  .chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  .chip { flex: none; }
  .card { flex-basis: 80%; }
  /* A more compact text area, so the photo gets more of the card (owners, Oct 30: "a little less card"). */
  .body { padding: 12px 14px 14px; gap: 4px; }
  h3 { font-size: 24px; }
  .tags { margin-top: 2px; gap: 3px; max-height: 62px; }
  .tags li, .tags-toggle button { font-size: 11px; }
  .tags li { padding: 4px 6px; }
  .tags-toggle button { padding: 3px 5px; }
  .more { font-size: 11px; }
  .book { min-height: 40px; font-size: 10px; letter-spacing: .08em; gap: 6px; }
  .book svg { width: 12px; height: 12px; }
  .nav { display: none; }
}
@media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
`

/** The brand fonts, declared on the page itself (fonts declared inside a shadow root aren't loaded). */
export function fontFaces(base: string): string {
  return `@font-face { font-family: 'Craft KK Topo'; src: url('${base}/fonts/kk-topo.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Craft Trio Grotesk'; src: url('${base}/fonts/trio-grotesk-bold.woff2') format('woff2'); font-weight: 700; font-display: swap; }`
}

export const EPILOGUE = 'https://fonts.googleapis.com/css2?family=Epilogue:wght@400;700&display=swap'
