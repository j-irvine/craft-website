// "Class schedule": the group class timetable embedded on the two group classes pages, in place of Arketa's
// schedule embed. One day at a time, so the page stays short; class and instructor filters list only what's
// on this studio's schedule. Showit holds one line:
//   <script src="https://…/class-schedule.js" data-location="park-slope"></script>
// Book opens Arketa's page for the class, where the client signs in and pays, as the old embed did.

import { EPILOGUE, fontFaces } from './styles'

interface ScheduleClass {
  id: string
  name: string
  start: string
  minutes: number
  instructor: string
  spotsLeft: number | null
  waitlist: number
}

interface Data {
  location: string
  classes: ScheduleClass[]
}

const TZ = 'America/New_York'
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const dayKey = (iso: string | Date) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString('en-US', { timeZone: TZ, ...o })
/** Noon on a YYYY-MM-DD day, so formatting it in New York never slips a day. */
const noon = (key: string) => new Date(`${key}T17:00:00Z`)
const checkout = (id: string) => `https://app.arketa.co/craftpilates/schedule/checkout/${encodeURIComponent(id)}`

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>'

export const SCHEDULE_CSS = `
:host {
  --mint: #c0caaf; --forest: #485c3d; --terracotta: #b64726; --chocolate: #352222; --cream: #ffe5c8; --peach: #e59d6d;
  --font-header: 'Craft KK Topo', 'KK Topo', 'Epilogue', system-ui, sans-serif;
  --font-sub: 'Craft Trio Grotesk', 'Trio Grotesk', 'Epilogue', system-ui, sans-serif;
  --font-body: 'Epilogue', system-ui, sans-serif;
  --text: var(--chocolate);
  --muted: color-mix(in srgb, var(--chocolate) 68%, var(--cream));
  --line: color-mix(in srgb, var(--chocolate) 40%, transparent);
  --on-bg: var(--chocolate); --on-text: var(--cream);
  --card: var(--cream); --card-text: var(--chocolate);
  --title: var(--terracotta);
  --cta: var(--chocolate); --cta-hover: var(--terracotta);
  display: block; height: 100%; min-height: 420px; color: var(--text); font-family: var(--font-body);
}
:host([data-theme='chocolate']), :host([data-theme='forest']) {
  --text: var(--cream);
  --muted: color-mix(in srgb, var(--cream) 72%, var(--chocolate));
  --line: color-mix(in srgb, var(--cream) 55%, transparent);
  --on-bg: var(--cream); --on-text: var(--chocolate);
  --title: var(--cream);
}
* { box-sizing: border-box; }
.cs { container-type: inline-size; height: 100%; display: flex; flex-direction: column; gap: 14px; }
.note { margin: auto; padding: 16px; text-align: center; color: var(--muted); max-width: 34ch; line-height: 1.45; }
.label { font: 700 10px/1 var(--font-sub); letter-spacing: .14em; text-transform: uppercase; }

.top { flex: none; display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: flex-end; justify-content: space-between; }
.week { display: flex; align-items: center; gap: 6px; min-width: 0; }
.arrow { flex: none; width: 36px; height: 52px; border: none; background: transparent; color: inherit; cursor: pointer; display: grid; place-items: center; padding: 0; }
.arrow svg { width: 18px; height: 18px; }
.arrow.prev svg { transform: rotate(180deg); }
.arrow:disabled { opacity: .25; cursor: default; }
.days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.day {
  width: 52px; height: 52px; border: 1px solid transparent; background: transparent; color: inherit; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 0; font-family: var(--font-body);
}
.day .dow { font: 700 9px/1 var(--font-sub); letter-spacing: .14em; text-transform: uppercase; }
.day .num { font-size: 17px; line-height: 1; }
.day:hover { border-color: var(--line); }
.day[aria-pressed='true'] { background: var(--on-bg); color: var(--on-text); border-color: var(--on-bg); }
.day:disabled { opacity: .3; cursor: default; border-color: transparent; }
.filters { display: flex; gap: 10px; }
.filter { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.select { position: relative; }
select {
  appearance: none; -webkit-appearance: none; width: 210px; max-width: 100%; height: 40px; border-radius: 0;
  border: 1px solid var(--line); background: transparent; color: inherit; padding: 0 34px 0 12px;
  font: 14px/1 var(--font-body); cursor: pointer;
}
select option { color: var(--chocolate); background: #fff; }
select:hover { border-color: currentColor; }
.select svg { position: absolute; right: 12px; top: 13px; width: 14px; height: 14px; transform: rotate(90deg); pointer-events: none; }
button:focus-visible, select:focus-visible, a:focus-visible { outline: 2px solid var(--peach); outline-offset: 2px; }

.heading { flex: none; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 10px; }
.heading h3 { margin: 0; font: 400 26px/1.1 var(--font-header); color: var(--title); }
.heading .count { color: var(--muted); font-size: 13px; white-space: nowrap; }
.clear { font: inherit; color: inherit; background: none; border: none; padding: 0; text-decoration: underline; cursor: pointer; }

.list { flex: 1; min-height: 0; overflow-y: auto; display: grid; gap: 8px 16px; align-content: start; grid-auto-flow: column; scrollbar-width: thin; padding-bottom: 2px; }
.row { display: grid; grid-template-columns: 78px minmax(0, 1fr) auto; align-items: center; gap: 12px; background: var(--card); color: var(--card-text); padding: 10px 10px 10px 14px; min-height: 64px; }
.time { font-weight: 700; font-size: 15px; line-height: 1.2; white-space: nowrap; }
.time small { display: block; font-weight: 400; font-size: 12px; color: color-mix(in srgb, var(--chocolate) 65%, var(--cream)); margin-top: 3px; }
.what { min-width: 0; }
.name { font: 700 11px/1.3 var(--font-sub); letter-spacing: .12em; text-transform: uppercase; }
.who { font-size: 13px; margin-top: 4px; }
.side { display: flex; align-items: center; gap: 12px; }
.spots { font-size: 12px; color: color-mix(in srgb, var(--chocolate) 70%, var(--cream)); text-align: right; white-space: nowrap; }
.spots.low { color: var(--terracotta); font-weight: 700; }
.book {
  display: inline-flex; align-items: center; justify-content: center; min-width: 104px; height: 40px; padding: 0 14px;
  font: 700 10px/1 var(--font-sub); letter-spacing: .14em; text-transform: uppercase; text-decoration: none;
  background: var(--cta); color: var(--cream); border: 1px solid var(--cta);
}
.book:hover { background: var(--cta-hover); border-color: var(--cta-hover); }
.book.wait { background: transparent; color: var(--chocolate); }
.book.wait:hover { background: var(--chocolate); color: var(--cream); border-color: var(--chocolate); }
.empty { color: var(--muted); padding: 20px 0; }

/* Phone: the day strip and filters each take a full row; classes in one column. */
@container (max-width: 700px) {
  .top { flex-direction: column; align-items: stretch; gap: 12px; }
  .week { justify-content: space-between; }
  .arrow { width: 26px; }
  .days { flex: 1; gap: 2px; }
  .day { width: auto; height: 50px; }
  .filters { gap: 8px; }
  .filter { flex: 1; }
  select { width: 100%; font-size: 13px; padding-left: 10px; }
  .heading h3 { font-size: 22px; }
  .list { display: flex; flex-direction: column; }
  .row { flex: none; }
  .row { grid-template-columns: 60px minmax(0, 1fr) auto; grid-template-areas: 'time what book' 'time spots book'; gap: 4px 10px; padding: 12px 10px 12px 12px; }
  .time { grid-area: time; align-self: start; font-size: 14px; }
  .what { grid-area: what; }
  .side { display: contents; }
  .spots { grid-area: spots; text-align: left; }
  .book { grid-area: book; }
  .book { width: 92px; min-width: 0; height: 40px; padding: 0; letter-spacing: .12em; }
  .name { letter-spacing: .08em; }
}
`

class ClassSchedule extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' })
  private data: Data | null = null
  private day: string | null = null
  private week = 0
  private type = ''
  private instructor = ''

  connectedCallback() {
    if (this.getAttribute('data-fonts') !== 'none') loadFonts(this.getAttribute('data-api') ?? '')
    this.root.innerHTML = `<style>${SCHEDULE_CSS}</style><div class="cs" aria-busy="true"><p class="note">Loading the schedule…</p></div>`
    void this.load()
  }

  private shell() {
    return this.root.querySelector('.cs') as HTMLElement
  }

  private async load() {
    try {
      const inline = this.getAttribute('data-json')
      if (inline) this.data = JSON.parse(inline) as Data
      else {
        const res = await fetch(`${this.getAttribute('data-api')}/api/schedule?location=${this.getAttribute('data-location')}`)
        if (!res.ok) throw new Error(String(res.status))
        this.data = (await res.json()) as Data
      }
      this.render()
    } catch {
      this.shell().innerHTML = `<p class="note">We couldn't load the schedule just now. Please try again in a minute, or <a href="https://app.arketa.co/craftpilates/schedule">see it on our booking site</a>.</p>`
    }
  }

  /** The 14 days shown, from today (or the preview's first day). */
  private days(): string[] {
    const first = this.getAttribute('data-today') ?? dayKey(new Date())
    return Array.from({ length: 14 }, (_, i) => dayKey(new Date(noon(first).getTime() + i * 86_400_000)))
  }

  private upcoming(): ScheduleClass[] {
    const now = this.getAttribute('data-now') ? Date.parse(this.getAttribute('data-now')!) : Date.now()
    return (this.data?.classes ?? []).filter((c) => Date.parse(c.start) > now)
  }

  private matching(): ScheduleClass[] {
    return this.upcoming().filter((c) => (!this.type || c.name === this.type) && (!this.instructor || c.instructor === this.instructor))
  }

  private render() {
    const all = this.upcoming()
    const shown = this.matching()
    const days = this.days()
    const byDay = new Map<string, ScheduleClass[]>()
    for (const c of shown) byDay.set(dayKey(c.start), [...(byDay.get(dayKey(c.start)) ?? []), c])
    // Start on the first day with something to book; a picked day that empties out moves on too.
    if (!this.day || !days.includes(this.day)) this.day = days.find((d) => byDay.has(d)) ?? days[0]
    if (!byDay.has(this.day)) {
      const next = days.find((d) => d >= this.day! && byDay.has(d)) ?? days.find((d) => byDay.has(d))
      if (next) this.day = next
    }
    this.week = days.indexOf(this.day) >= 7 ? 1 : 0

    const types = [...new Set(all.map((c) => c.name))].sort()
    const people = [...new Set(all.map((c) => c.instructor).filter(Boolean))].sort()
    const option = (v: string, picked: string, label = v) => `<option value="${esc(v)}"${v === picked ? ' selected' : ''}>${esc(label)}</option>`
    const week = days.slice(this.week * 7, this.week * 7 + 7)
    const today = days[0]
    const list = byDay.get(this.day) ?? []
    const filtered = Boolean(this.type || this.instructor)
    const heading = this.day === today ? 'Today' : fmt(noon(this.day), { weekday: 'long', month: 'long', day: 'numeric' })

    this.shell().removeAttribute('aria-busy')
    this.shell().innerHTML = `
      <div class="top">
        <div class="week" role="group" aria-label="Day">
          <button class="arrow prev" type="button" aria-label="Previous week"${this.week === 0 ? ' disabled' : ''}>${CHEVRON}</button>
          <div class="days">
            ${week
              .map((d) => {
                const date = noon(d)
                const has = byDay.has(d)
                return `<button class="day" type="button" data-day="${d}" aria-pressed="${d === this.day}"${has ? '' : ' disabled'} aria-label="${esc(fmt(date, { weekday: 'long', month: 'long', day: 'numeric' }))}${has ? '' : ', no classes'}">
                  <span class="dow">${esc(fmt(date, { weekday: 'short' }))}</span><span class="num">${esc(fmt(date, { day: 'numeric' }))}</span></button>`
              })
              .join('')}
          </div>
          <button class="arrow next" type="button" aria-label="Next week"${this.week === 1 ? ' disabled' : ''}>${CHEVRON}</button>
        </div>
        <div class="filters">
          <label class="filter"><span class="label">Class</span><span class="select"><select data-filter="type">${option('', this.type, 'All classes')}${types.map((t) => option(t, this.type)).join('')}</select>${CHEVRON}</span></label>
          <label class="filter"><span class="label">Instructor</span><span class="select"><select data-filter="instructor">${option('', this.instructor, 'All instructors')}${people.map((p) => option(p, this.instructor)).join('')}</select>${CHEVRON}</span></label>
        </div>
      </div>
      <div class="heading">
        <h3>${esc(heading)}</h3>
        <span class="count">${filtered ? `${list.length} matching · <button class="clear" type="button">Show all classes</button>` : `${list.length} ${list.length === 1 ? 'class' : 'classes'}`}</span>
      </div>
      <div class="list" style="grid-template-rows: repeat(${Math.max(1, Math.ceil(list.length / 2))}, max-content)">
        ${list.length ? list.map((c) => this.row(c)).join('') : `<p class="empty">${filtered ? 'No matching classes in the next two weeks.' : 'No classes left to book this day.'}</p>`}
      </div>`

    this.shell().querySelectorAll<HTMLButtonElement>('.day').forEach((b) => b.addEventListener('click', () => { this.day = b.dataset.day!; this.render() }))
    this.shell().querySelector('.prev')?.addEventListener('click', () => this.jumpWeek(0))
    this.shell().querySelector('.next')?.addEventListener('click', () => this.jumpWeek(1))
    this.shell().querySelector('.clear')?.addEventListener('click', () => { this.type = ''; this.instructor = ''; this.render() })
    this.shell().querySelectorAll<HTMLSelectElement>('select').forEach((s) =>
      s.addEventListener('change', () => {
        if (s.dataset.filter === 'type') this.type = s.value
        else this.instructor = s.value
        this.render()
      }),
    )
  }

  /** Moving a week lands on that week's first day with classes. */
  private jumpWeek(week: number) {
    const days = this.days().slice(week * 7, week * 7 + 7)
    const has = new Set(this.matching().map((c) => dayKey(c.start)))
    this.day = days.find((d) => has.has(d)) ?? days[0]
    this.render()
  }

  private row(c: ScheduleClass): string {
    const start = new Date(c.start)
    const full = c.spotsLeft === 0
    const spots = c.spotsLeft === null ? '' : full ? (c.waitlist ? `Full · ${c.waitlist} on waitlist` : 'Full') : `${c.spotsLeft} ${c.spotsLeft === 1 ? 'spot' : 'spots'} left`
    const low = c.spotsLeft !== null && c.spotsLeft > 0 && c.spotsLeft <= 2
    const label = `${full ? 'Join the waitlist for' : 'Book'} ${c.name}${c.instructor ? ` with ${c.instructor}` : ''}, ${fmt(start, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}`
    return `<div class="row">
      <div class="time">${esc(fmt(start, { hour: 'numeric', minute: '2-digit' }))}<small>${c.minutes} min</small></div>
      <div class="what"><div class="name">${esc(c.name)}</div>${c.instructor ? `<div class="who">with ${esc(c.instructor)}</div>` : ''}</div>
      <div class="side"><span class="spots${low ? ' low' : ''}">${esc(spots)}</span>
        <a class="book${full ? ' wait' : ''}" href="${checkout(c.id)}" target="_blank" rel="noopener" aria-label="${esc(label)}">${full ? 'Waitlist' : 'Book'}</a></div>
    </div>`
  }
}

function loadFonts(base: string) {
  if (document.getElementById('craft-fonts')) return
  const style = document.createElement('style')
  style.id = 'craft-fonts'
  style.textContent = fontFaces(base)
  document.head.append(style)
  if (!document.querySelector(`link[href="${EPILOGUE}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = EPILOGUE
    document.head.append(link)
  }
}

if (!customElements.get('craft-class-schedule')) customElements.define('craft-class-schedule', ClassSchedule)

// Mount next to the script tag that loaded us, with its settings.
const script = document.currentScript as HTMLScriptElement | null
if (script?.src) {
  const el = document.createElement('craft-class-schedule')
  el.setAttribute('data-location', script.dataset.location ?? 'park-slope')
  el.setAttribute('data-api', new URL(script.src).origin)
  if (script.dataset.theme) el.setAttribute('data-theme', script.dataset.theme)
  script.after(el)
}
