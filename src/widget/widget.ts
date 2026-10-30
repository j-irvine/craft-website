// "Find Your Person": the instructor directory embedded on the two privates pages.
// Showit holds one line: <script src="https://…/find-your-person.js" data-location="park-slope"></script>
// The script puts a <craft-find-your-person> right where it sits, filling the Showit embed box.
// Everything renders in a shadow root so the Showit page's styles and ours never collide.

import { CSS, EPILOGUE, fontFaces } from './styles'
import { openBooking, type Session } from './panel'

interface Specialty {
  key: string
  label: string
}

interface Instructor {
  id: string
  name: string
  specialties: string[]
  yearsLabel: string | null
  certification: string | null
  bio: string | null
  photo: string | null
  /** Their calendars at this studio (Private first), once staff add their Arketa link to the sheet. */
  sessions?: Session[] | null
}

interface Data {
  location: string
  specialties: Specialty[]
  instructors: Instructor[]
  /** Arketa's page where the client picks Private or Duet and then an instructor, at this studio. */
  booking?: string
  /** The calendars for any instructor at this studio, Private first. */
  sessions?: Session[]
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// The booking button scrolls down to the page's booking calendar, so its arrow points down.
const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m-6-6l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>'

/**
 * What "Book with [name]" does: "scroll" goes down to the page's Arketa calendar (owners, 29 Oct 2026);
 * "panel" opens Arketa's booking for that instructor at this studio, privates and duets, over the page.
 * The snippet's data-booking picks one, so the panel can be tried before it becomes the default.
 */
const DEFAULT_BOOKING: 'scroll' | 'panel' = 'scroll'

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

class FindYourPerson extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' })
  private data: Data | null = null
  private filter: string | null = null
  private open = new Set<string>()
  /** Cards whose full tag list is showing ("+N more" pressed). */
  private allTags = new Set<string>()
  private resize: ResizeObserver | undefined
  private toastTimer: ReturnType<typeof setTimeout> | undefined

  connectedCallback() {
    if (this.getAttribute('data-fonts') !== 'none') loadFonts(this.getAttribute('data-api') ?? '')
    this.root.innerHTML = `<style>${CSS}</style><div class="fyp" aria-busy="true"><p class="note">Loading instructors…</p></div>`
    void this.load()
  }

  private async load() {
    const src = this.getAttribute('data-src') ?? `${this.getAttribute('data-api')}/api/instructors?location=${this.getAttribute('data-location')}`
    try {
      // data-json: the list inline, for previews that can't fetch.
      const inline = this.getAttribute('data-json')
      const res = inline ? null : await fetch(src)
      if (res && !res.ok) throw new Error(String(res.status))
      this.data = (inline ? JSON.parse(inline) : await res!.json()) as Data
      this.render()
    } catch {
      this.shell().innerHTML = `<p class="note">We couldn't load our instructors just now. Email us and we'll help you find the right one.</p>`
    }
  }

  private shell() {
    return this.root.querySelector('.fyp') as HTMLElement
  }

  private render() {
    const d = this.data!
    const labels = new Map(d.specialties.map((s) => [s.key, s.label]))
    // Only offer chips someone at this studio actually has.
    const offered = d.specialties.filter((s) => d.instructors.some((i) => i.specialties.includes(s.key)))
    const matches = (i: Instructor) => !this.filter || i.specialties.includes(this.filter)
    const shown = d.instructors.filter(matches)

    const chip = (key: string | null, label: string) =>
      `<button class="chip" type="button" data-filter="${key ?? ''}" aria-pressed="${this.filter === key}">${esc(label)}</button>`

    const panel = this.bookingMode() === 'panel' && Boolean(d.booking)
    // First in the row, as in Arketa's own instructor picker: many clients choose by time, not by person (owners, 30 Oct 2026).
    const anyone = panel
      ? `<article class="card any">
          <div class="body">
            <h3>Any availability</h3>
            <p class="bio">Every open time for privates and duets at ${esc(d.location)}, with any instructor.</p>
            <button class="book" type="button" data-book=""><span>See all times</span>${ARROW}</button>
          </div>
        </article>`
      : ''
    const card = (i: Instructor) => {
      const photo = i.photo
        ? `<img src="${esc(new URL(i.photo, this.getAttribute('data-api') || location.href).href)}" alt="" loading="lazy">`
        : `<img class="placeholder" src="${esc(this.placeholder())}" alt="" loading="lazy">`
      const tags = i.specialties
        .map((k) => `<li class="${k === this.filter ? 'on' : ''}">${esc(labels.get(k) ?? k)}</li>`)
        .join('')
      const isOpen = this.open.has(i.id)
      const allTags = this.allTags.has(i.id)
      // "Show fewer" only when the full list was opened with "+N more"; "More about" shows every tag too.
      const fewer = allTags && !isOpen ? `<li class="tags-toggle"><button type="button" aria-expanded="true">Show fewer</button></li>` : ''
      return `<article class="card${isOpen ? ' open' : ''}${allTags ? ' all-tags' : ''}${matches(i) ? '' : ' out'}" data-id="${esc(i.id)}">
        <div class="photo">${photo}</div>
        <div class="body">
          <h3>${esc(i.name)}</h3>
          ${i.yearsLabel ? `<p class="years">${esc(i.yearsLabel)}</p>` : ''}
          ${tags ? `<ul class="tags">${tags}${fewer}</ul>` : ''}
          ${i.bio ? `<p class="bio">${esc(i.bio)}</p>` : ''}
          ${i.certification ? `<div class="cert"><p class="label">Certification</p><p>${esc(i.certification)}</p></div>` : ''}
          ${i.certification || i.bio ? `<button class="more" type="button" aria-expanded="${isOpen}">${isOpen ? 'Less' : `More about ${esc(i.name)}`}</button>` : ''}
          <button class="book" type="button" data-book="${esc(i.id)}"><span>Book with ${esc(i.name)}</span>${panel ? ARROW : DOWN}</button>
        </div>
      </article>`
    }

    this.shell().removeAttribute('aria-busy')
    this.shell().innerHTML = `
      <div class="chips" role="group" aria-label="Filter by specialty">
        ${chip(null, 'All')}${offered.map((s) => chip(s.key, s.label)).join('')}
      </div>
      <div class="rail">
        <button class="nav prev" type="button" aria-label="Previous instructors">${ARROW}</button>
        <div class="track" tabindex="0" aria-label="Instructors">
          ${anyone}${d.instructors.map(card).join('')}${shown.length ? '' : `<p class="note">No instructors match that yet.</p>`}
        </div>
        <button class="nav next" type="button" aria-label="More instructors">${ARROW}</button>
      </div>
      <div class="toast" role="status" aria-live="polite"></div>`

    this.root.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) =>
      b.addEventListener('click', () => {
        this.filter = b.dataset.filter || null
        this.render()
        this.track().scrollTo({ left: 0 })
      }),
    )
    this.root.querySelectorAll<HTMLButtonElement>('.more').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.closest<HTMLElement>('.card')!.dataset.id!
        this.open.has(id) ? this.open.delete(id) : this.open.add(id)
        const left = this.track().scrollLeft
        this.render()
        this.track().scrollLeft = left
      }),
    )
    // "+N more" and "Show fewer" (added by fitTags) open and close one card's full tag list.
    this.root.querySelectorAll<HTMLElement>('.tags').forEach((ul) =>
      ul.addEventListener('click', (e) => {
        if (!(e.target as HTMLElement).closest('.tags-toggle')) return
        const id = ul.closest<HTMLElement>('.card')!.dataset.id!
        this.allTags.has(id) ? this.allTags.delete(id) : this.allTags.add(id)
        const left = this.track().scrollLeft
        this.render()
        this.track().scrollLeft = left
      }),
    )
    this.root.querySelectorAll<HTMLButtonElement>('.book').forEach((b) =>
      b.addEventListener('click', () => this.book(d.instructors.find((i) => i.id === b.dataset.book) ?? null, b)),
    )
    const step = () => (this.track().querySelector('.card')?.clientWidth ?? 260) + 16
    this.root.querySelector('.prev')!.addEventListener('click', () => this.track().scrollBy({ left: -step(), behavior: 'smooth' }))
    this.root.querySelector('.next')!.addEventListener('click', () => this.track().scrollBy({ left: step(), behavior: 'smooth' }))
    this.track().addEventListener('scroll', () => this.updateNav(), { passive: true })
    requestAnimationFrame(() => {
      this.updateNav()
      this.fit()
    })
    // Tags wrap differently once the brand fonts arrive and when the Showit box changes width.
    void document.fonts?.ready.then(() => this.fit())
    if (!this.resize && typeof ResizeObserver !== 'undefined') {
      let width = 0
      this.resize = new ResizeObserver(([entry]) => {
        if (Math.abs(entry.contentRect.width - width) < 1) return
        width = entry.contentRect.width
        this.fit()
      })
      this.resize.observe(this)
    }
  }

  private fit() {
    this.fitTags()
    this.fitBodies()
  }

  /**
   * Closed cards' text is one height, the fullest card's, so names line up without a gap above most
   * cards' buttons (owners, Oct 30). Measured with the button straight under the text, over every
   * instructor at the studio, filtered out or not, so photos don't change size with the filter (owners, Oct 30).
   */
  private fitBodies() {
    const bodies = [...this.root.querySelectorAll<HTMLElement>('.card:not(.open):not(.all-tags):not(.any) .body')]
    if (!bodies.length) return
    // Filtered-out cards are laid out just for the measurement, within this frame, so they never show.
    this.track().classList.add('measuring')
    this.style.removeProperty('--body-h')
    const tallest = Math.max(
      ...bodies.map((b) => {
        b.style.height = 'auto'
        const book = b.querySelector<HTMLElement>('.book')
        if (book) book.style.marginTop = '10px'
        const h = b.getBoundingClientRect().height
        b.style.height = ''
        if (book) book.style.marginTop = ''
        return h
      }),
    )
    this.track().classList.remove('measuring')
    if (tallest > 0) this.style.setProperty('--body-h', `${Math.ceil(tallest)}px`)
  }

  /**
   * Closed cards show 3 lines of tags (owners, Oct 30). Where more don't fit, the last ones are hidden
   * behind a "+N more" tag that opens the full list.
   */
  private fitTags() {
    this.root.querySelectorAll<HTMLElement>('.card:not(.open):not(.all-tags) .tags').forEach((ul) => {
      ul.querySelector('.tags-toggle')?.remove()
      const items = [...ul.querySelectorAll<HTMLElement>('li')]
      items.forEach((li) => (li.hidden = false))
      const fits = () => ul.scrollHeight <= ul.clientHeight + 1
      if (fits()) return
      const more = document.createElement('li')
      more.className = 'tags-toggle'
      more.innerHTML = '<button type="button" aria-expanded="false"></button>'
      ul.append(more)
      let hidden = 0
      for (let n = items.length - 1; n > 0; n--) {
        items[n].hidden = true
        hidden++
        more.querySelector('button')!.textContent = `+${hidden} more`
        if (fits()) break
      }
    })
  }

  /** The studio photo shown until an instructor has their own (data-placeholder overrides, for previews). */
  private placeholder() {
    return this.getAttribute('data-placeholder') ?? new URL('/placeholder.jpg', this.getAttribute('data-api') || location.href).href
  }

  private track() {
    return this.root.querySelector('.track') as HTMLElement
  }

  private updateNav() {
    const t = this.track()
    this.root.querySelector<HTMLButtonElement>('.prev')!.disabled = t.scrollLeft < 4
    this.root.querySelector<HTMLButtonElement>('.next')!.disabled = t.scrollLeft + t.clientWidth > t.scrollWidth - 4
  }

  private bookingMode(): 'scroll' | 'panel' {
    const mode = this.getAttribute('data-booking')
    return mode === 'panel' || mode === 'scroll' ? mode : DEFAULT_BOOKING
  }

  /** "Book with [name]", or "See all times" (no instructor). */
  private book(i: Instructor | null, button: HTMLElement) {
    const d = this.data!
    if (this.bookingMode() === 'panel' && d.booking) {
      const picker = [{ type: 'private', label: 'Private or duet', url: d.booking }] satisfies Session[]
      if (!i) return openBooking('Any availability', `Every instructor · ${d.location}`, d.sessions?.length ? d.sessions : picker, button)
      if (i.sessions?.length) return openBooking(`Book with ${i.name}`, d.location, i.sessions, button)
      // Until staff add their Arketa link to the sheet, the studio's page, where the client picks them.
      return openBooking(`Book with ${i.name}`, `Choose ${i.name} as your instructor · ${d.location}`, picker, button)
    }
    this.scrollToCalendar(i)
  }

  /** Scrolls to the page's booking calendar and says who to pick there. */
  private scrollToCalendar(i: Instructor | null) {
    const calendar = document.querySelector('[data-craft-booking], iframe[src*="arketa"]')
    calendar?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const toast = this.root.querySelector('.toast') as HTMLElement
    toast.textContent = i ? `Choose ${i.name} in the booking calendar.` : 'Choose a time in the booking calendar.'
    toast.classList.add('show')
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => toast.classList.remove('show'), 5000)
  }

}

/** Once per page: the brand fonts from the Worker, and Epilogue from Google Fonts. */
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

if (!customElements.get('craft-find-your-person')) customElements.define('craft-find-your-person', FindYourPerson)

// Mount next to the script tag that loaded us, with its settings.
const script = document.currentScript as HTMLScriptElement | null
if (script?.src) {
  const el = document.createElement('craft-find-your-person')
  el.setAttribute('data-location', script.dataset.location ?? 'park-slope')
  el.setAttribute('data-api', new URL(script.src).origin)
  if (script.dataset.src) el.setAttribute('data-src', script.dataset.src)
  if (script.dataset.theme) el.setAttribute('data-theme', script.dataset.theme)
  if (script.dataset.booking) el.setAttribute('data-booking', script.dataset.booking)
  script.after(el)
}
