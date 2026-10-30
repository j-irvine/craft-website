// The booking panel: Arketa's privates booking page for one instructor (or any instructor), over the page.
// It's added to <body> rather than inside the Showit embed box, so it isn't cut to the box's size, and a
// transformed Showit ancestor can't pin it to the box. Booking and payment happen inside Arketa's page.

const CSS = `
:host {
  --chocolate: #352222;
  --cream: #ffe5c8;
  --terracotta: #b64726;
  --forest: #485c3d;
  position: fixed; inset: 0; z-index: 2147483000;
  display: grid; place-items: center;
  background: color-mix(in srgb, var(--chocolate) 72%, transparent);
  font-family: 'Epilogue', system-ui, sans-serif;
}
.panel {
  width: min(760px, calc(100vw - 48px)); height: min(900px, calc(100dvh - 48px));
  display: flex; flex-direction: column; background: var(--cream); color: var(--chocolate);
  box-shadow: 0 20px 60px rgb(0 0 0 / .35);
}
header { flex: none; display: flex; align-items: flex-start; gap: 12px; padding: 18px 18px 14px 22px; }
.titles { flex: 1; min-width: 0; }
h2 { margin: 0; font: 400 30px/1.05 'Craft KK Topo', 'KK Topo', 'Epilogue', system-ui, sans-serif; color: var(--terracotta); overflow-wrap: anywhere; }
p { margin: 6px 0 0; font: 13px/1.4 'Epilogue', system-ui, sans-serif; }
.close {
  flex: none; width: 44px; height: 44px; border: 0; border-radius: 0; cursor: pointer;
  background: var(--chocolate); color: var(--cream); display: grid; place-items: center;
}
.close:hover { background: var(--terracotta); }
.close svg { width: 18px; height: 18px; }
.tabs { flex: none; display: flex; gap: 8px; padding: 0 22px 14px; }
.tab {
  min-height: 40px; padding: 0 18px; border: 1px solid var(--chocolate); border-radius: 0; cursor: pointer;
  background: transparent; color: var(--chocolate);
  font: 700 11px/1 'Craft Trio Grotesk', 'Trio Grotesk', 'Epilogue', system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase;
}
.tab[aria-selected='true'] { background: var(--chocolate); color: var(--cream); }
.frame { flex: 1; min-height: 0; position: relative; background: #fff; border-top: 1px solid color-mix(in srgb, var(--chocolate) 15%, transparent); }
iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.unavailable { flex: 1; min-height: 0; padding: 8px 22px 28px; }
.unavailable p { margin: 0 0 18px; max-width: 34em; font: 16px/1.5 'Epilogue', system-ui, sans-serif; }
.email {
  display: inline-flex; align-items: center; min-height: 48px; padding: 0 22px; background: var(--chocolate); color: var(--cream);
  font: 700 12px/1 'Craft Trio Grotesk', 'Trio Grotesk', 'Epilogue', system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; text-decoration: none;
}
.email:hover { background: var(--terracotta); }
.panel.short { height: auto; }
.loading { position: absolute; inset: 0; display: grid; place-items: center; font: 14px/1.4 'Epilogue', system-ui, sans-serif; color: var(--chocolate); }
@media (max-width: 600px) {
  :host { display: block; }
  .panel { width: 100%; height: 100%; height: 100dvh; box-shadow: none; }
  header { padding: max(14px, env(safe-area-inset-top, 0px)) 14px 12px 16px; }
  .short header { padding-top: 14px; }
  h2 { font-size: 26px; }
  .tabs { padding: 0 16px 12px; }
  .tab { flex: 1; }
  :host(.short) { display: grid; place-items: center; }
  .panel.short { width: calc(100% - 32px); height: auto; box-shadow: 0 20px 60px rgb(0 0 0 / .35); }
  .unavailable { padding: 8px 16px 24px; }
}
`

/** One calendar the panel can show: a session type (Private, Duet) and Arketa's page for it. */
export interface Session {
  type: string
  label: string
  url: string
}

const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

let current: { host: HTMLElement; done: () => void } | null = null

/** Says to email the studio, when there's no calendar to book (owners, 30 Oct 2026). */
export interface Unavailable {
  message: string
  email: string
}

/**
 * Opens the panel on the first of `sessions` (Private, then Duet), with tabs to switch when there's more than one.
 * With no sessions, it shows `unavailable` instead. Esc, the × or a tap outside closes it, and focus goes back to `returnTo`.
 */
export function openBooking(title: string, note: string, sessions: Session[], returnTo?: HTMLElement | null, unavailable?: Unavailable) {
  const tabs = sessions.length > 1
    ? `<div class="tabs" role="tablist" aria-label="Session type">${sessions
        .map((s, n) => `<button class="tab" type="button" role="tab" aria-selected="${n === 0}" data-n="${n}">${esc(s.label)}</button>`)
        .join('')}</div>`
    : ''
  current?.done()
  const host = document.createElement('craft-booking-panel')
  if (!sessions.length) host.className = 'short'
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>${CSS}</style>
    <div class="panel${sessions.length ? '' : ' short'}" role="dialog" aria-modal="true" aria-labelledby="t">
      <header>
        <div class="titles"><h2 id="t">${esc(title)}</h2><p>${esc(note)}</p></div>
        <button class="close" type="button" aria-label="Close">${CLOSE}</button>
      </header>
      ${tabs}
      ${sessions.length
        ? `<div class="frame">
        <p class="loading">Loading times…</p>
        <iframe title="${esc(title)}" src="${esc(sessions[0].url)}" allow="payment; fullscreen" allowfullscreen></iframe>
      </div>`
        : `<div class="unavailable"><p>${esc(unavailable?.message ?? '')}</p>${unavailable ? `<a class="email" href="mailto:${esc(unavailable.email)}">Email us</a>` : ''}</div>`}
    </div>`

  // Keep the page behind from scrolling while the panel is open.
  const html = document.documentElement
  const overflow = html.style.overflow
  html.style.overflow = 'hidden'

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') done()
  }
  const done = () => {
    host.remove()
    html.style.overflow = overflow
    document.removeEventListener('keydown', onKey)
    current = null
    returnTo?.focus()
  }
  document.addEventListener('keydown', onKey)
  root.querySelector('.close')!.addEventListener('click', done)
  host.addEventListener('click', (e) => {
    if (e.composedPath()[0] === host) done()
  })
  const frame = root.querySelector('iframe')
  frame?.addEventListener('load', () => root.querySelector('.loading')?.remove())
  root.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) =>
    tab.addEventListener('click', () => {
      if (tab.getAttribute('aria-selected') === 'true') return
      root.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)))
      frame!.src = sessions[Number(tab.dataset.n)].url
    }),
  )

  document.body.append(host)
  current = { host, done }
  root.querySelector<HTMLButtonElement>('.close')!.focus()
}
