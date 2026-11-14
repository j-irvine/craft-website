// "Class schedule": the group class timetable embedded on the two group classes pages, in place of Arketa's
// schedule embed. It looks like Arketa's embed (owners, 14 Nov 2026: "much closer to how it looks in the
// regular Arketa embed"), with these changes: one day at a time, so the page stays short; no location filter
// (the snippet picks the studio); class and instructor filters with only what's on this studio's schedule;
// spots left only when 3 or fewer, and how many are on the waitlist. Showit holds one line:
//   <script src="https://…/class-schedule.js" data-location="park-slope"></script>
// Sign Up opens Arketa's page for the class, where the client signs in and pays, as the old embed did.

interface ScheduleClass {
  id: string
  name: string
  start: string
  minutes: number
  instructor: string
  spotsLeft: number | null
  waitlist: number
  canceled: boolean
}

interface Data {
  location: string
  classes: ScheduleClass[]
  descriptions: Record<string, string>
  instructors: Record<string, { bio: string | null; photo: string | null }>
}

/** Spots left are shown only from this few down (owners, 14 Nov 2026). */
const FEW_SPOTS = 3
const TZ = 'America/New_York'
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ })
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString('en-US', { timeZone: TZ, ...o })
/** Noon (New York) on a YYYY-MM-DD day, so formatting it never slips a day. */
const noon = (key: string) => new Date(`${key}T17:00:00Z`)
const addDays = (key: string, n: number) => dayKey(new Date(noon(key).getTime() + n * 86_400_000))
const checkout = (id: string) => `https://app.arketa.co/craftpilates/schedule/checkout/${encodeURIComponent(id)}`

const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const CARET = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

// Arketa's embed as set up for Craft: Helvetica Neue, chocolate text, terracotta buttons and links, on the
// page's cream.
export const SCHEDULE_CSS = `
:host {
  --text: #352222; --accent: #b54826; --accent-hover: #963a1e; --on-accent: #fff;
  --muted: #a39a95; --line: rgba(53, 34, 34, .14); --field-line: #ccc; --placeholder: #808080;
  --font: 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif;
  display: block; color: var(--text); font: 16px/24px var(--font);
}
/* data-height="fill": fills a fixed-height box and scrolls inside it. By default it's as tall as the day's
   classes, since the Showit section it sits in grows with it (the old Arketa embed did the same). */
:host([data-height='fill']) { height: 100%; min-height: 420px; }
* { box-sizing: border-box; }
.cs { container-type: inline-size; display: flex; flex-direction: column; min-height: 300px; }
:host([data-height='fill']) .cs { height: 100%; }
.note { margin: auto; padding: 16px; text-align: center; max-width: 36ch; }
.note a { color: var(--accent); }

.filters { flex: none; display: grid; grid-template-columns: repeat(2, minmax(0, 290px)); justify-content: center; gap: 12px 30px; padding: 0 0 22px; }
.select { position: relative; }
select {
  appearance: none; -webkit-appearance: none; width: 100%; height: 38px; border: 1px solid var(--field-line); border-radius: 4px;
  background: #fff; color: var(--text); padding: 0 46px 0 10px; font: 16px/1 var(--font); cursor: pointer;
}
select.unset { color: var(--placeholder); }
select option { color: var(--text); }
.select::after { content: ''; position: absolute; right: 38px; top: 8px; bottom: 8px; width: 1px; background: var(--field-line); pointer-events: none; }
.select svg { position: absolute; right: 10px; top: 9px; width: 20px; height: 20px; color: var(--field-line); pointer-events: none; }
select:hover { border-color: #b3b3b3; }
button:focus-visible, select:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.week { flex: none; display: flex; justify-content: center; align-items: center; gap: 4px; font-size: 18px; line-height: 27px; }
.week .short { display: none; }
.arrow { width: 32px; height: 32px; border: none; background: none; color: var(--text); cursor: pointer; display: grid; place-items: center; padding: 0; }
.arrow svg { width: 22px; height: 22px; }
.arrow.prev svg { transform: rotate(180deg); }
.arrow[hidden] { visibility: hidden; display: grid !important; }
.days { flex: none; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 14px 0 34px; }
.day { border: none; background: none; color: var(--text); font: 18px/27px var(--font); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0; }
.day .num { width: 40px; height: 40px; line-height: 40px; border-radius: 50%; text-align: center; }
.day:hover:not(:disabled) .num { background: rgba(181, 72, 38, .1); }
.day[aria-pressed='true'] .num { background: var(--accent); color: var(--on-accent); }
.day:disabled { color: var(--muted); cursor: default; }

.heading { flex: none; margin: 0 0 0; padding: 0 0 10px; border-bottom: 1px solid var(--line); font: 500 20px/24px var(--font); letter-spacing: 3.2px; font-variant: all-petite-caps; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.heading .count { font: 14px/20px var(--font); letter-spacing: 0; font-variant: normal; color: var(--text); white-space: nowrap; }
.clear { font: inherit; color: var(--accent); background: none; border: none; padding: 0; cursor: pointer; text-decoration: underline; }

.list { flex: 1; min-height: 0; }
:host([data-height='fill']) .list { overflow-y: auto; scrollbar-width: thin; }
.cls { padding: 22px 5px 20px; border-bottom: 1px solid var(--line); }
.row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.info { min-width: 0; }
.info p { margin: 0; }
.name { font-size: 20px; font-weight: 500; margin: 1px 0 4px !important; }
.who { font-weight: 700; }
.toggle { margin-top: 8px; font: inherit; color: var(--accent); background: none; border: 1px solid transparent; border-radius: 4px; padding: 0; cursor: pointer; }
.toggle:hover { text-decoration: underline; }
.act { flex: none; display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
/* Spots left (3 or fewer) and the waitlist: beside the button, the size of the class's own text, lined up
   with the button (owners, 14 Nov 2026: smaller text perched above it looked out of place). */
.spots { font-size: 16px; line-height: 22px; text-align: right; }
.spots .few { color: var(--accent); font-weight: 700; }
.more { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 16px; padding: 28px 0 8px; }
.show-more, .pick-day { font: 16px/24px var(--font); border-radius: 4px; padding: 6px 16px; cursor: pointer; border: 1px solid var(--accent); background: transparent; color: var(--accent); }
.show-more:hover, .pick-day:hover { background: var(--accent); color: var(--on-accent); }
.heading.extra { margin-top: 40px; }
.book { display: inline-block; padding: 6px 12px; border-radius: 4px; border: 1px solid var(--accent); background: var(--accent); color: var(--on-accent); text-decoration: none; white-space: nowrap; }
.book:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.canceled { color: var(--text); font-weight: 700; margin-bottom: 30px; }
.details { padding-top: 16px; }
.details p { margin: 0 0 12px; }
.details ul, .details ol { margin: 0 0 12px; padding-left: 22px; }
.person { display: flex; align-items: center; gap: 8px; margin: 20px 0 10px; font-weight: 700; }
.photo { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; object-position: center 25%; background: #e8dccf; flex: none; display: grid; place-items: center; font-weight: 500; color: var(--text); }
.empty { padding: 24px 5px; }

@container (max-width: 600px) {
  .filters { grid-template-columns: minmax(0, 1fr); padding-bottom: 18px; }
  .days { padding: 8px 0 26px; }
  .week .long { display: none; }
  .week .short { display: inline; }
  .day { font-size: 16px; }
  .day .num { width: 34px; height: 34px; line-height: 34px; font-size: 17px; }
  .heading { font-size: 19px; letter-spacing: 2.4px; flex-wrap: wrap; }
  .cls { padding: 18px 2px 16px; }
  .act { flex-direction: column; align-items: flex-end; gap: 8px; margin-bottom: 32px; }
  .spots { font-size: 15px; line-height: 20px; }
}
`

class ClassSchedule extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' })
  private data: Data | null = null
  private day: string | null = null
  private week = 0
  private type = ''
  private instructor = ''
  private open = new Set<string>()
  /** Days added under the picked one with Show More. */
  private more = 0

  connectedCallback() {
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
      this.shell().innerHTML = `<p class="note">We couldn't load the schedule just now. Please try again in a minute, or <a href="https://app.arketa.co/craftpilates/schedule" target="_blank" rel="noopener">see it on our booking site</a>.</p>`
    }
  }

  /** Classes still to come (a cancelled one stays, marked, as on Arketa). */
  private upcoming(): ScheduleClass[] {
    return (this.data?.classes ?? []).filter((c) => Date.parse(c.start) > Date.now())
  }

  private matching(): ScheduleClass[] {
    return this.upcoming().filter((c) => (!this.type || c.name === this.type) && (!this.instructor || c.instructor === this.instructor))
  }

  /** Sunday-to-Saturday weeks, as on Arketa, from this week to the last day with classes. */
  private weeks(): string[][] {
    const today = dayKey(new Date())
    const sunday = addDays(today, -noon(today).getUTCDay())
    const last = this.upcoming().map((c) => dayKey(c.start)).sort().pop() ?? today
    const out: string[][] = []
    for (let start = sunday; start <= last || !out.length; start = addDays(start, 7)) out.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)))
    return out
  }

  private render() {
    const all = this.upcoming()
    const shown = this.matching()
    const weeks = this.weeks()
    const byDay = new Map<string, ScheduleClass[]>()
    for (const c of shown) byDay.set(dayKey(c.start), [...(byDay.get(dayKey(c.start)) ?? []), c])
    const bookable = (d: string) => byDay.get(d)?.some((c) => !c.canceled) ?? false
    const flat = weeks.flat()
    // Start on the first day with a class; a picked day that the filters empty moves to the next one that has one.
    if (!this.day || !bookable(this.day)) this.day = flat.find((d) => d >= (this.day ?? '') && bookable(d)) ?? flat.find(bookable) ?? this.day ?? flat[0]
    this.week = Math.max(0, weeks.findIndex((w) => w.includes(this.day!)))
    const week = weeks[this.week]

    const types = [...new Set(all.map((c) => c.name))].sort()
    const people = [...new Set(all.map((c) => c.instructor).filter(Boolean))].sort()
    const option = (v: string, picked: string, label = v) => `<option value="${esc(v)}"${v === picked ? ' selected' : ''}>${esc(label)}</option>`
    const list = byDay.get(this.day) ?? []
    const filtered = Boolean(this.type || this.instructor)
    const range = `${fmt(noon(week[0]), { month: 'long', day: 'numeric' })} — ${fmt(noon(week[6]), { month: 'long', day: 'numeric' })}`
    const shortRange = `${fmt(noon(week[0]), { month: 'short', day: 'numeric' })} — ${fmt(noon(week[6]), { month: 'short', day: 'numeric' })}`
    // The picked day, then any added with Show More (owners, 14 Nov 2026: like Arketa's, it adds the next day
    // with classes under the ones showing).
    const after = flat.filter((d) => d > this.day! && bookable(d))
    const extra = after.slice(0, this.more)
    const hasMore = after.length > extra.length
    const count = list.filter((c) => !c.canceled).length

    this.shell().removeAttribute('aria-busy')
    this.shell().innerHTML = `
      <div class="filters">
        <label class="select"><span hidden>Class type</span><select data-filter="type" aria-label="Class type"${this.type ? '' : ' class="unset"'}>${option('', this.type, 'All Class Types')}${types.map((t) => option(t, this.type)).join('')}</select>${CARET}</label>
        <label class="select"><span hidden>Instructor</span><select data-filter="instructor" aria-label="Instructor"${this.instructor ? '' : ' class="unset"'}>${option('', this.instructor, 'All Instructors')}${people.map((p) => option(p, this.instructor)).join('')}</select>${CARET}</label>
      </div>
      <div class="week">
        <button class="arrow prev" type="button" aria-label="Previous week"${this.week === 0 ? ' hidden' : ''}>${CHEVRON}</button>
        <span class="long">${esc(range)}</span><span class="short">${esc(shortRange)}</span>
        <button class="arrow next" type="button" aria-label="Next week"${this.week >= weeks.length - 1 ? ' hidden' : ''}>${CHEVRON}</button>
      </div>
      <div class="days" role="group" aria-label="Day">
        ${week
          .map((d) => {
            const date = noon(d)
            const has = bookable(d)
            return `<button class="day" type="button" data-day="${d}" aria-pressed="${d === this.day}"${has ? '' : ' disabled'} aria-label="${esc(fmt(date, { weekday: 'long', month: 'long', day: 'numeric' }))}${has ? '' : ', no classes'}">
              <span>${esc(fmt(date, { weekday: 'short' }))}</span><span class="num">${esc(fmt(date, { day: 'numeric' }))}</span></button>`
          })
          .join('')}
      </div>
      <h3 class="heading"><span>${esc(fmt(noon(this.day), { weekday: 'long', month: 'short', day: 'numeric' }))}</span>${
        filtered ? `<span class="count">${count} matching · <button class="clear" type="button">Show all</button></span>` : ''
      }</h3>
      <div class="list">
        ${list.length ? list.map((c) => this.row(c)).join('') : `<p class="empty">${filtered ? 'No matching classes in the next two weeks.' : 'No classes left to book this day.'}</p>`}
        ${extra
          .map((d) => `<h3 class="heading extra"><span>${esc(fmt(noon(d), { weekday: 'long', month: 'short', day: 'numeric' }))}</span></h3>${(byDay.get(d) ?? []).map((c) => this.row(c)).join('')}`)
          .join('')}
      </div>
      ${
        // "Pick Another Day" goes back up to the week bar, keeping the day (owners, 14 Nov 2026).
        hasMore || list.length
          ? `<div class="more">${hasMore ? '<button class="show-more" type="button">Show More</button>' : ''}<button class="pick-day" type="button">Pick Another Day</button></div>`
          : ''
      }`

    const on = (sel: string, fn: (el: HTMLElement) => void) => this.shell().querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)))
    on('.day', (b) => { this.day = b.dataset.day!; this.more = 0; this.render(); this.keepInView() })
    on('.prev', () => this.jumpWeek(this.week - 1))
    on('.next', () => this.jumpWeek(this.week + 1))
    on('.show-more', () => { this.more++; this.render() })
    on('.pick-day', () => {
      const week = this.root.querySelector('.week') as HTMLElement | null
      if (week) window.scrollBy({ top: week.getBoundingClientRect().top - 100, behavior: 'smooth' })
    })
    on('.clear', () => { this.type = ''; this.instructor = ''; this.more = 0; this.render() })
    on('.toggle', (b) => {
      const id = b.dataset.id!
      if (this.open.has(id)) this.open.delete(id)
      else this.open.add(id)
      const cls = b.closest('.cls')!
      cls.querySelector('.details')?.toggleAttribute('hidden', !this.open.has(id))
      b.setAttribute('aria-expanded', String(this.open.has(id)))
    })
    this.shell().querySelectorAll<HTMLSelectElement>('select').forEach((s) =>
      s.addEventListener('change', () => {
        this.more = 0
        if (s.dataset.filter === 'type') this.type = s.value
        else this.instructor = s.value
        this.render()
      }),
    )
  }

  /** After a shorter day replaces a longer one, the page may be scrolled past the schedule: bring its top back. */
  private keepInView() {
    const top = this.getBoundingClientRect().top
    if (top < 0) window.scrollBy({ top: top - 16 })
  }

  /** Moving a week lands on that week's first day with a class. */
  private jumpWeek(i: number) {
    const week = this.weeks()[i]
    if (!week) return
    const has = new Set(this.matching().filter((c) => !c.canceled).map((c) => dayKey(c.start)))
    this.day = week.find((d) => has.has(d)) ?? week[0]
    this.week = i
    this.more = 0
    this.render()
  }

  private row(c: ScheduleClass): string {
    const start = new Date(c.start)
    const time = `${fmt(start, { hour: '2-digit', minute: '2-digit' })} ${start.toLocaleTimeString('en-US', { timeZone: TZ, timeZoneName: 'short' }).split(' ').pop()} • (${c.minutes} min)`
    const full = c.spotsLeft === 0
    const notes = [
      c.spotsLeft !== null && c.spotsLeft > 0 && c.spotsLeft <= FEW_SPOTS ? `<span class="few">${c.spotsLeft} ${c.spotsLeft === 1 ? 'spot' : 'spots'} left</span>` : '',
      c.waitlist > 0 ? `${c.waitlist} on waitlist` : '',
    ].filter(Boolean)
    const studio = this.data?.location ?? ''
    const desc = this.data?.descriptions[c.name]
    const person = c.instructor ? this.data?.instructors[c.instructor] : undefined
    const open = this.open.has(c.id)
    const initials = c.instructor.split(' ').map((w) => w[0]).join('').slice(0, 2)
    const details =
      desc || person?.bio
        ? `<div class="details"${open ? '' : ' hidden'}>
            ${desc ?? ''}
            ${person ? `<div class="person">${person.photo ? `<img class="photo" src="${esc(person.photo)}" alt="" loading="lazy" width="60" height="60">` : `<span class="photo" aria-hidden="true">${esc(initials)}</span>`}${esc(c.instructor)}</div>${person.bio ?? ''}` : ''}
          </div>`
        : ''
    const label = `${full ? 'Join the waitlist for' : 'Sign up for'} ${c.name}${c.instructor ? ` with ${c.instructor}` : ''}, ${fmt(start, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}`
    return `<div class="cls">
      <div class="row">
        <div class="info">
          <p>${esc(time)}</p>
          <p class="name">${esc(c.name)}</p>
          ${c.instructor ? `<p class="who">${esc(c.instructor)}</p>` : ''}
          <p>${esc(studio)}</p>
          ${details && !c.canceled ? `<button class="toggle" type="button" data-id="${esc(c.id)}" aria-expanded="${open}">View Details</button>` : ''}
        </div>
        ${
          c.canceled
            ? '<div class="canceled">Canceled</div>'
            : `<div class="act">${notes.length ? `<span class="spots">${notes.join('<br>')}</span>` : ''}<a class="book" href="${checkout(c.id)}" target="_blank" rel="noopener" aria-label="${esc(label)}">${full ? 'Waitlist' : 'Sign Up'}</a></div>`
        }
      </div>
      ${c.canceled ? '' : details}
    </div>`
  }
}

if (!customElements.get('craft-class-schedule')) customElements.define('craft-class-schedule', ClassSchedule)

// Mount next to the script tag that loaded us, with its settings.
const script = document.currentScript as HTMLScriptElement | null
if (script?.src) {
  const el = document.createElement('craft-class-schedule')
  el.setAttribute('data-location', script.dataset.location ?? 'park-slope')
  el.setAttribute('data-api', new URL(script.src).origin)
  if (script.dataset.height) el.setAttribute('data-height', script.dataset.height)
  script.after(el)
}
