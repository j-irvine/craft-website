// Turns the instructor form's responses sheet into the client-safe list the website shows.
// Columns are found by their header text, so reordering or adding columns doesn't break anything.
// Only fields listed in `PublicInstructor` ever leave this module.

export type Location = 'park-slope' | 'uws'

export const LOCATIONS: Record<Location, string> = { 'park-slope': 'Park Slope', uws: 'Upper West Side' }

/** The public filter chips, in display order, and the form's client areas each one covers. */
export const SPECIALTIES = [
  { key: 'beginners', label: 'Beginners', areas: ['Beginners or returning after a break'] },
  { key: 'strength', label: 'Strength & athletic', areas: ['Strength and athletic performance'] },
  { key: 'pregnancy', label: 'Pregnancy & postpartum', areas: ['Pregnancy', 'Postpartum'] },
  {
    key: 'older-adults',
    label: 'Older adults & bone health',
    areas: ['Older adults, balance and mobility', 'Low bone density, including osteoporosis'],
  },
  { key: 'teens', label: 'Teens', areas: ['Teens'] },
  {
    key: 'back',
    label: 'Back pain',
    areas: ['Sciatica', 'Herniated or bulging discs', 'Other back injuries or persistent back pain', 'Scoliosis'],
  },
  {
    key: 'injury',
    label: 'Injury & surgery recovery',
    areas: [
      'Returning after injury or managing physical limitations',
      'Shoulder, hip or knee injuries',
      'Returning after surgery or joint replacement',
      'Arthritis and other joint conditions',
      'Hypermobility and joint stability',
    ],
  },
  { key: 'neuro', label: 'Neurological conditions', areas: ['Neurological conditions affecting movement or balance'] },
] as const

export type SpecialtyKey = (typeof SPECIALTIES)[number]['key']

/** Answers in a client-area grid that earn a public tag (owners, 29 Oct 2026). "Interested" and "a few clients" don't. */
const QUALIFYING_ANSWERS = ['have substantial teaching experience', 'completed relevant training']

export interface PublicInstructor {
  id: string
  name: string
  locations: Location[]
  specialties: SpecialtyKey[]
  yearsLabel: string | null
  certification: string | null
  bio: string | null
  bookUrl: string | null
  photo: string | null
}

/** Something staff should fix in the sheet. Says the row, never the person's answers. */
export interface SheetWarning {
  row: number
  message: string
}

export interface SheetResult {
  instructors: PublicInstructor[]
  warnings: SheetWarning[]
}

interface Columns {
  timestamp: number
  email: number
  name: number
  years: number
  privates: number
  certification: number
  locations: number
  bio: number
  hide: number
  bookUrl: number
  photoLink: number
  areas: Map<string, number>
}

const find = (headers: string[], test: (h: string) => boolean) => headers.findIndex((h) => test(h.toLowerCase()))

export function findColumns(headerRow: string[]): Columns {
  const h = headerRow.map((x) => String(x ?? '').trim())
  const areas = new Map<string, number>()
  h.forEach((header, i) => {
    const m = /\[(.+)\]\s*$/.exec(header)
    if (m && header.toLowerCase().includes('client area')) areas.set(m[1].trim(), i)
  })
  return {
    timestamp: find(h, (x) => x === 'timestamp'),
    email: find(h, (x) => x === 'email address' || x === 'email'),
    name: find(h, (x) => x === 'your name' || x === 'name'),
    years: find(h, (x) => x.includes('years') && x.includes('taught')),
    privates: find(h, (x) => x.includes('private clients')),
    certification: find(h, (x) => x.includes('certification')),
    locations: find(h, (x) => x.includes('location')),
    bio: find(h, (x) => /\bbio\b/.test(x)),
    hide: find(h, (x) => x.includes('hide from website')),
    bookUrl: find(h, (x) => x.includes('arketa') || x.includes('booking link')),
    photoLink: find(h, (x) => x.includes('photo')),
    areas,
  }
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30,
}

/** Reads a free-text years answer ("2.5", "Two years", "10 yrs", "<1", "A year and a half"). Null when it can't. */
export function parseYears(raw: unknown): number | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null
  if (/^(<|under|less than)\s*1\b/.test(s)) return 0.5
  const n = /(\d+(?:\.\d+)?)/.exec(s)
  if (n) return Number(n[1])
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(s)) return value + (/\bhalf\b/.test(s) ? 0.5 : 0)
  }
  if (/\ba year\b/.test(s)) return 1 + (/\bhalf\b/.test(s) ? 0.5 : 0)
  return null
}

export function yearsLabel(years: number | null): string | null {
  if (years === null) return null
  if (years < 1) return 'Less than a year teaching'
  const whole = Math.floor(years)
  const unit = whole === 1 ? 'year' : 'years'
  return whole === years ? `${whole} ${unit} teaching` : `${whole}+ ${unit} teaching`
}

/** Park Slope, UWS, or both, from the form's location answer (checkboxes, so comma-separated). */
export function parseLocations(raw: unknown): Location[] {
  const s = String(raw ?? '').toLowerCase()
  const out: Location[] = []
  if (s.includes('park slope')) out.push('park-slope')
  if (s.includes('uws') || s.includes('upper west')) out.push('uws')
  return out
}

function specialtiesFor(row: unknown[], cols: Columns): SpecialtyKey[] {
  const qualifies = (area: string) => {
    const i = cols.areas.get(area)
    if (i === undefined) return false
    const answer = String(row[i] ?? '').toLowerCase()
    return QUALIFYING_ANSWERS.some((a) => answer.includes(a))
  }
  return SPECIALTIES.filter((s) => s.areas.some(qualifies)).map((s) => s.key)
}

const isChecked = (v: unknown) => v === true || String(v ?? '').trim().toUpperCase() === 'TRUE'

const clean = (v: unknown) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  return s || null
}

function safeUrl(v: unknown): string | null {
  const s = clean(v)
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** A stable, non-reversible id from the email, so the page never carries emails. */
export async function instructorId(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email))
  return [...new Uint8Array(digest)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The whole sheet (header row first) to the public list. `photos` maps a lowercased form email to the
 * URL the website serves that instructor's photo from.
 */
export async function buildInstructors(
  rows: unknown[][],
  photos: Map<string, string> = new Map(),
): Promise<SheetResult> {
  const [header, ...body] = rows
  const cols = findColumns((header ?? []).map(String))
  const warnings: SheetWarning[] = []
  for (const [name, i] of Object.entries({ email: cols.email, name: cols.name, privates: cols.privates })) {
    if (i < 0) throw new Error(`The sheet has no ${name} column`)
  }
  if (cols.locations < 0) warnings.push({ row: 1, message: 'No location column yet, so nobody is shown' })

  // Latest response per email wins. Sheet rows are in submission order, but compare timestamps anyway.
  const latest = new Map<string, { row: unknown[]; rowNumber: number; time: number }>()
  body.forEach((row, i) => {
    const email = String(row[cols.email] ?? '').trim().toLowerCase()
    if (!email) return
    const time = cols.timestamp >= 0 ? Date.parse(String(row[cols.timestamp] ?? '')) || 0 : 0
    const prev = latest.get(email)
    if (!prev || time >= prev.time) latest.set(email, { row, rowNumber: i + 2, time })
  })

  const people: (PublicInstructor & { first: string; last: string })[] = []
  for (const [email, { row, rowNumber }] of latest) {
    if (cols.hide >= 0 && isChecked(row[cols.hide])) continue
    if (String(row[cols.privates] ?? '').trim().toLowerCase() !== 'yes') continue
    const [first = '', ...rest] = (clean(row[cols.name]) ?? '').split(' ')
    if (!first) {
      warnings.push({ row: rowNumber, message: 'No name' })
      continue
    }
    const locations = cols.locations >= 0 ? parseLocations(row[cols.locations]) : []
    if (cols.locations >= 0 && locations.length === 0) {
      warnings.push({ row: rowNumber, message: 'No location for privates, so not shown' })
      continue
    }
    const years = cols.years >= 0 ? parseYears(row[cols.years]) : null
    if (cols.years >= 0 && clean(row[cols.years]) && years === null) {
      warnings.push({ row: rowNumber, message: "Couldn't read years teaching, so it's left off" })
    }
    const bookUrl = cols.bookUrl >= 0 ? safeUrl(row[cols.bookUrl]) : null
    if (cols.bookUrl >= 0 && clean(row[cols.bookUrl]) && !bookUrl) {
      warnings.push({ row: rowNumber, message: "The booking link isn't a valid https link" })
    }
    people.push({
      id: await instructorId(email),
      first,
      last: rest.join(' '),
      name: first,
      locations,
      specialties: specialtiesFor(row, cols),
      yearsLabel: yearsLabel(years),
      certification: cols.certification >= 0 ? clean(row[cols.certification]) : null,
      bio: cols.bio >= 0 ? clean(row[cols.bio]) : null,
      bookUrl,
      photo: photos.get(email) ?? null,
    })
  }

  // First names, with the last initial when two share a first name (as in the studio app).
  const counts = new Map<string, number>()
  for (const p of people) counts.set(p.first.toLowerCase(), (counts.get(p.first.toLowerCase()) ?? 0) + 1)
  const instructors = people
    .map(({ first, last, ...p }) => ({
      ...p,
      name: (counts.get(first.toLowerCase()) ?? 0) > 1 && last ? `${first} ${last[0].toUpperCase()}` : first,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { instructors, warnings }
}

export function forLocation(instructors: PublicInstructor[], location: Location): PublicInstructor[] {
  return instructors.filter((i) => i.locations.includes(location))
}
