// Turns the instructor form's responses sheet into the client-safe list the website shows.
// Columns are found by their header text, so reordering or adding columns doesn't break anything.
// Only fields listed in `PublicInstructor` ever leave this module.

export type Location = 'park-slope' | 'uws'

export const LOCATIONS: Record<Location, string> = { 'park-slope': 'Park Slope', uws: 'Upper West Side' }

/** Arketa's id for each studio, which narrows its privates booking page to that studio's Private and Duet sessions. */
export const ARKETA_LOCATIONS: Record<Location, string> = { 'park-slope': '67ptpiCjvCsriKuEdItN', uws: 'N80JtYm27xFQhqhv8wam' }

/**
 * Arketa's privates booking page for one studio, where the client picks Private or Duet, then an instructor.
 * With an instructor (Arketa's "host" id) it shows only theirs. Checked live on 30 Oct 2026. Used when an
 * instructor has no Arketa link yet, so the client can pick them there.
 */
export function arketaBookingUrl(location: Location, host: string | null): string {
  const q = new URLSearchParams({ ...(host ? { host } : {}), location: ARKETA_LOCATIONS[location] })
  return `https://app.arketa.co/iframe/craftpilates/privates/by-service?${q}`
}

export type SessionType = 'private' | 'duet'

/** Each studio's Arketa services for privates and duets. */
export const ARKETA_SERVICES: Record<Location, Record<SessionType, string>> = {
  'park-slope': { private: 'W6jMmZalGy1q2aEynEMt', duet: '44ToNiZDKxDKpmC8IXnf' },
  uws: { private: 'qm64gHeSlUrvjQSAiLpe', duet: 'dS81rRoLiWfJSzTJlw5s' },
}

export interface Session {
  type: SessionType
  label: string
  url: string
}

/**
 * Straight to the calendar for one session type at one studio: one instructor's times, or everyone's
 * ("any"). This skips Arketa's service list (which puts Duet first) and its "Select an instructor" step,
 * where clients had to pick "Any availability" a second time (owners, 30 Oct 2026; checked live that day).
 * Private comes first.
 */
export function arketaSessions(location: Location, host: string | null, offers: SessionType[] = ['private', 'duet']): Session[] {
  return (['private', 'duet'] as const)
    .filter((type) => offers.includes(type))
    .map((type) => {
      const q = new URLSearchParams({ instructorId: host ?? 'any', locationId: ARKETA_LOCATIONS[location] })
      return {
        type,
        label: type === 'private' ? 'Private' : 'Duet',
        url: `https://app.arketa.co/iframe/craftpilates/privates/by-service/${ARKETA_SERVICES[location][type]}/location?${q}`,
      }
    })
}

/** The instructor's Arketa id from what staff paste: the "Private availability" link, its embed code, or the bare id. */
export function arketaHostId(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const m = /[?&]host=([A-Za-z0-9]{10,40})\b/.exec(s) ?? /^([A-Za-z0-9]{20,40})$/.exec(s)
  return m ? m[1] : null
}

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
  photo: string | null
  /** Arketa's id for them, from the sheet's "Arketa booking link". Null until staff paste it. */
  arketaHost: string | null
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
  photoLink: number
  arketa: number
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
    photoLink: find(h, (x) => x.includes('photo')),
    arketa: find(h, (x) => x.includes('arketa') || x.includes('booking link')),
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

/** Below this, years teaching are left off the card (owners, Oct 30). */
export const MIN_YEARS_SHOWN = 3

export function yearsLabel(years: number | null): string | null {
  if (years === null || years < MIN_YEARS_SHOWN) return null
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


/** A stable, non-reversible id from the email, so the page never carries emails. */
export async function instructorId(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email))
  return [...new Uint8Array(digest)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Latest response per email. Sheet rows are in submission order, but compare timestamps anyway. */
function latestByEmail(body: unknown[][], cols: Columns) {
  const latest = new Map<string, { row: unknown[]; rowNumber: number; time: number }>()
  body.forEach((row, i) => {
    const email = String(row[cols.email] ?? '').trim().toLowerCase()
    if (!email) return
    const time = cols.timestamp >= 0 ? Date.parse(String(row[cols.timestamp] ?? '')) || 0 : 0
    const prev = latest.get(email)
    if (!prev || time >= prev.time) latest.set(email, { row, rowNumber: i + 2, time })
  })
  return latest
}

/** The Drive file id in a row's "Photo link" column, by lowercased email (latest response). */
export function photoLinks(rows: unknown[][]): Map<string, string> {
  const [header, ...body] = rows
  const cols = findColumns((header ?? []).map(String))
  const out = new Map<string, string>()
  if (cols.photoLink < 0 || cols.email < 0) return out
  for (const [email, { row }] of latestByEmail(body, cols)) {
    const id = driveFileId(row[cols.photoLink])
    if (id) out.set(email, id)
  }
  return out
}

/** Emails of everyone who could be shown (taking privates, not hidden): whose photos to keep. */
export function candidateEmails(rows: unknown[][]): string[] {
  const [header, ...body] = rows
  const cols = findColumns((header ?? []).map(String))
  if (cols.email < 0 || cols.privates < 0) return []
  return [...latestByEmail(body, cols)]
    .filter(([, { row }]) => !(cols.hide >= 0 && isChecked(row[cols.hide])) && String(row[cols.privates] ?? '').trim().toLowerCase() === 'yes')
    .map(([email]) => email)
}

/** A name reduced for matching photo file names: lowercase, no accents, words separated by single spaces. */
export function nameKey(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Candidates' full names (as nameKey) to their email, for photos named by name rather than email.
 * A name two people share is left out, so neither gets the other's photo.
 */
export function photoNames(rows: unknown[][]): Map<string, string> {
  const [header, ...body] = rows
  const cols = findColumns((header ?? []).map(String))
  const out = new Map<string, string>()
  if (cols.name < 0 || cols.email < 0) return out
  const candidates = new Set(candidateEmails(rows))
  const clashes = new Set<string>()
  for (const [email, { row }] of latestByEmail(body, cols)) {
    if (!candidates.has(email)) continue
    const key = nameKey(String(row[cols.name] ?? ''))
    if (!key) continue
    if (out.has(key)) clashes.add(key)
    out.set(key, email)
  }
  for (const key of clashes) out.delete(key)
  return out
}

/** A Drive file id from a share link (".../file/d/<id>/view", "...open?id=<id>") or a bare id. */
export function driveFileId(link: unknown): string | null {
  const s = String(link ?? '').trim()
  if (!s) return null
  const m = /\/d\/([\w-]{10,})/.exec(s) ?? /[?&]id=([\w-]{10,})/.exec(s) ?? /^([\w-]{20,})$/.exec(s)
  return m ? m[1] : null
}

/**
 * The whole sheet (header row first) to the public list. `photos` maps a lowercased form email to the
 * URL the website serves that instructor's photo from.
 */
export async function buildInstructors(
  rows: unknown[][],
  photos: Map<string, string> = new Map(),
  arketaNames: Record<string, string> = {},
): Promise<SheetResult> {
  const [header, ...body] = rows
  const cols = findColumns((header ?? []).map(String))
  const warnings: SheetWarning[] = []
  for (const [name, i] of Object.entries({ email: cols.email, name: cols.name, privates: cols.privates })) {
    if (i < 0) throw new Error(`The sheet has no ${name} column`)
  }
  if (cols.locations < 0) warnings.push({ row: 1, message: 'No location column yet, so nobody is shown' })

  const latest = latestByEmail(body, cols)

  const people: (PublicInstructor & { first: string; last: string; rowNumber: number })[] = []
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
    const rawLink = cols.arketa >= 0 ? clean(row[cols.arketa]) : null
    const arketaHost = arketaHostId(rawLink)
    if (rawLink && !arketaHost) warnings.push({ row: rowNumber, message: "Couldn't read the Arketa booking link, so Book opens the studio's calendar" })
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
      photo: photos.get(email) ?? null,
      arketaHost,
      rowNumber,
    })
  }

  // Everyone without a link in the sheet is matched to Arketa by name (owners, Oct 30: no links to paste).
  for (const p of people) {
    if (p.arketaHost) continue
    p.arketaHost = matchArketaHost(p, people, arketaNames)
    if (!p.arketaHost && Object.keys(arketaNames).length) {
      warnings.push({ row: p.rowNumber, message: "No instructor with this name on Arketa's privates, so Book opens the studio's calendar. Paste their Arketa link to fix it" })
    }
  }

  // First names, with the last initial when two share a first name (as in the studio app).
  const counts = new Map<string, number>()
  for (const p of people) counts.set(p.first.toLowerCase(), (counts.get(p.first.toLowerCase()) ?? 0) + 1)
  const instructors = people
    .map(({ first, last, rowNumber: _, ...p }) => ({
      ...p,
      name: (counts.get(first.toLowerCase()) ?? 0) > 1 && last ? `${first} ${last[0].toUpperCase()}` : first,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { instructors, warnings }
}

/**
 * The Arketa instructor for someone in the sheet, by the name Arketa's booking pages show: their full name,
 * or their first name with or without the last initial ("Sarah K", "Abby"). Only a match that's unique on
 * both sides counts: a first name two sheet instructors share needs the initial, and a name two Arketa
 * instructors share matches nobody.
 */
export function matchArketaHost(
  person: { first: string; last: string },
  people: { first: string }[],
  arketaNames: Record<string, string>,
): string | null {
  const full = nameKey(`${person.first} ${person.last}`)
  const initial = person.last ? nameKey(`${person.first} ${person.last[0]}`) : null
  const first = nameKey(person.first)
  const sharedFirst = people.filter((p) => nameKey(p.first) === first).length > 1
  const ids = (test: (key: string) => boolean) => Object.entries(arketaNames).filter(([, n]) => test(nameKey(n))).map(([id]) => id)
  for (const found of [ids((k) => k === full), initial ? ids((k) => k === initial) : [], sharedFirst ? [] : ids((k) => k === first)]) {
    if (found.length === 1) return found[0]
    if (found.length > 1) return null
  }
  return null
}

/** The filter chips worth offering: only specialties someone in the list has (owners, 29 Oct 2026). */
export function offeredSpecialties(instructors: PublicInstructor[]): { key: SpecialtyKey; label: string }[] {
  return SPECIALTIES.filter((s) => instructors.some((i) => i.specialties.includes(s.key))).map(({ key, label }) => ({ key, label }))
}

export function forLocation(instructors: PublicInstructor[], location: Location): PublicInstructor[] {
  return instructors.filter((i) => i.locations.includes(location))
}
