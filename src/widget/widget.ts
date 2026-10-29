// "Find Your Person": the instructor directory embedded on the two privates pages.
// Showit holds one line: <script src="https://…/find-your-person.js" data-location="park-slope"></script>
// The script puts a <craft-find-your-person> right where it sits, filling the Showit embed box.
// Everything renders in a shadow root so the Showit page's styles and ours never collide.

import { MARK_SVG } from './mark'
import { CSS, EPILOGUE, fontFaces } from './styles'

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
}

interface Data {
  location: string
  specialties: Specialty[]
  instructors: Instructor[]
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// The booking button scrolls down to the page's booking calendar, so its arrow points down.
const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m-6-6l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>'

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

class FindYourPerson extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' })
  private data: Data | null = null
  private filter: string | null = null
  private open = new Set<string>()
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
    const shown = this.filter ? d.instructors.filter((i) => i.specialties.includes(this.filter!)) : d.instructors

    const chip = (key: string | null, label: string) =>
      `<button class="chip" type="button" data-filter="${key ?? ''}" aria-pressed="${this.filter === key}">${esc(label)}</button>`

    const card = (i: Instructor) => {
      const photo = i.photo
        ? `<img src="${esc(i.photo)}" alt="" loading="lazy">`
        : `<div class="placeholder">${MARK_SVG}</div>`
      const tags = i.specialties
        .map((k) => `<li class="${k === this.filter ? 'on' : ''}">${esc(labels.get(k) ?? k)}</li>`)
        .join('')
      const facts = [i.yearsLabel, i.certification].filter(Boolean) as string[]
      const isOpen = this.open.has(i.id)
      return `<article class="card${isOpen ? ' open' : ''}" data-id="${esc(i.id)}">
        <div class="photo">${photo}</div>
        <div class="body">
          <h3>${esc(i.name)}</h3>
          ${i.yearsLabel ? `<p class="years">${esc(i.yearsLabel)}</p>` : ''}
          ${tags ? `<ul class="tags">${tags}</ul>` : ''}
          ${i.certification ? `<p class="cert">${esc(i.certification)}</p>` : ''}
          ${i.bio ? `<p class="bio">${esc(i.bio)}</p>` : ''}
          ${facts.length || i.bio ? `<button class="more" type="button" aria-expanded="${isOpen}">${isOpen ? 'Less' : `More about ${esc(i.name)}`}</button>` : ''}
          <button class="book" type="button" data-book="${esc(i.id)}">Book with ${esc(i.name)}${DOWN}</button>
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
          ${shown.length ? shown.map(card).join('') : `<p class="note">No instructors match that yet.</p>`}
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
    this.root.querySelectorAll<HTMLButtonElement>('.book').forEach((b) =>
      b.addEventListener('click', () => this.book(d.instructors.find((i) => i.id === b.dataset.book)!)),
    )
    const step = () => (this.track().querySelector('.card')?.clientWidth ?? 260) + 16
    this.root.querySelector('.prev')!.addEventListener('click', () => this.track().scrollBy({ left: -step(), behavior: 'smooth' }))
    this.root.querySelector('.next')!.addEventListener('click', () => this.track().scrollBy({ left: step(), behavior: 'smooth' }))
    this.track().addEventListener('scroll', () => this.updateNav(), { passive: true })
    requestAnimationFrame(() => this.updateNav())
  }

  private track() {
    return this.root.querySelector('.track') as HTMLElement
  }

  private updateNav() {
    const t = this.track()
    this.root.querySelector<HTMLButtonElement>('.prev')!.disabled = t.scrollLeft < 4
    this.root.querySelector<HTMLButtonElement>('.next')!.disabled = t.scrollLeft + t.clientWidth > t.scrollWidth - 4
  }

  /**
   * Arketa can't open one instructor's privates, so this scrolls to the page's booking calendar
   * (owners, 29 Oct 2026) and says who to pick there.
   */
  private book(i: Instructor) {
    const calendar = document.querySelector('[data-craft-booking], iframe[src*="arketa"]')
    calendar?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const toast = this.root.querySelector('.toast') as HTMLElement
    toast.textContent = `Choose ${i.name} in the booking calendar.`
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
  script.after(el)
}
