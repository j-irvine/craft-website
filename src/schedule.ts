// "Class schedule": the group class timetable for the two group classes pages, replacing Arketa's schedule
// embed, which lists the whole week at once and loads every instructor's full-size headshot (owners,
// 14 Nov 2026: the pages scroll for far too long). It looks like Arketa's embed but shows one day at a time,
// spots left only when 3 or fewer, the waitlist, and filters with only the classes and instructors on the
// schedule. Read from the same undocumented API behind Arketa's own schedule widget as src/arketa.ts.

import { WIDGET_API } from './arketa'
import { ARKETA_LOCATIONS, type Location } from './instructors'
import { nyDate } from './availability'

/** How many days ahead the schedule shows, from today. Two weeks, as Arketa's booking window. */
export const SCHEDULE_DAYS = 14

/**
 * Classes hidden on Arketa's public schedule that are joined only on Arketa (members-only). Arketa's widget
 * already leaves out classes it marks private, so this is a backstop, by name (Craft Apps does the same).
 */
export const MEMBERS_ONLY = ['craft circle']

/** One class as the embed shows it. */
export interface ScheduleClass {
  /** Arketa's class id, for its checkout page. */
  id: string
  name: string
  /** ISO, UTC. */
  start: string
  minutes: number
  instructor: string
  /** Null when Arketa doesn't say. */
  spotsLeft: number | null
  waitlist: number
  canceled: boolean
}

/** What "View details" shows for an instructor. `photo` is filled by the Worker with a small copy. */
export interface ScheduleInstructor {
  bio: string | null
  photo: string | null
}

export interface Schedule {
  location: string
  classes: ScheduleClass[]
  /** Each class name's description (simple HTML), for "View details". */
  descriptions: Record<string, string>
  /** By the name the classes show. */
  instructors: Record<string, ScheduleInstructor>
}

/** A schedule as read, with each instructor's Arketa photo address (full size, never sent to the page). */
export interface ReadSchedule extends Schedule {
  photoSources: Record<string, string>
}

/** Arketa's page for one class, where the client books it (or joins the waitlist), signing in there. */
export const checkoutUrl = (id: string) => `https://app.arketa.co/craftpilates/schedule/checkout/${id}`

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * Arketa's rich text cut down to paragraphs, line breaks, bold, italics and lists, with no attributes, so it
 * can go into the page safely. Empty paragraphs (Arketa's spacers) are dropped.
 */
export function simpleHtml(html: string): string {
  const allowed = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li'])
  let out = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (tag, name: string) => {
      const n = name.toLowerCase()
      if (!allowed.has(n)) return ''
      return tag.startsWith('</') ? `</${n}>` : n === 'br' ? '<br>' : `<${n}>`
    })
    .replace(/<(?!\/?(?:p|br|b|strong|i|em|ul|ol|li)>)/gi, '&lt;')
    .replace(/&nbsp;/g, ' ')
  out = out.replace(/<p>(\s|<br>)*<\/p>/g, '').replace(/<(b|strong)>(\s*)<\/\1>/g, '$2')
  return out.trim()
}

/**
 * Instructors as on the rest of the site: first name, with the last initial only when two share a first
 * name. Arketa's names are mostly that already ("Sarah K"), but some are full ("Keilaa-Demi De La Cruz"), and
 * those are shortened.
 */
export function shortNames(names: string[]): Map<string, string> {
  const unique = [...new Set(names.map(clean))]
  const first = (n: string) => n.split(' ')[0]
  const count = new Map<string, number>()
  for (const n of unique) count.set(first(n).toLowerCase(), (count.get(first(n).toLowerCase()) ?? 0) + 1)
  const out = new Map<string, string>()
  for (const n of unique) {
    const parts = n.split(' ')
    // Already short ("Sarah D", "Grace"): kept as Arketa has it, since other studios' instructors may share it.
    if (parts.length === 1 || parts[parts.length - 1].length === 1) out.set(n, n)
    else if (count.get(first(n).toLowerCase()) === 1) out.set(n, parts[0])
    else out.set(n, `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}`)
  }
  return out
}

type Raw = {
  id?: unknown; name?: unknown; start_time?: unknown; duration?: unknown; hostName?: unknown; canceled?: unknown
  display?: unknown; experience_type?: unknown; max_capacity?: unknown; total_booked?: unknown; waitlistLength?: unknown
  description?: unknown; descriptionHTML?: unknown; hostData?: unknown
}

/** The client-safe schedule in one reply from Arketa's widget, or null when the reply isn't what we expect. */
export function scheduleFromReply(body: unknown, location: string, now = new Date()): ReadSchedule | null {
  const raw = (body as { data?: { classes?: unknown } } | null)?.data?.classes
  if (!Array.isArray(raw)) return null
  const rows = (raw as Raw[]).filter(
    (c) =>
      typeof c?.id === 'string' && typeof c.name === 'string' && typeof c.start_time === 'number' &&
      (c.display ?? 'public') === 'public' && (c.experience_type ?? 'Class') === 'Class' &&
      !MEMBERS_ONLY.some((m) => clean(c.name as string).toLowerCase().includes(m)) &&
      (c.start_time as number) * 1000 > now.getTime(),
  )
  const names = shortNames(rows.map((c) => (typeof c.hostName === 'string' ? c.hostName : '')).filter(Boolean))
  const descriptions: Record<string, string> = {}
  const instructors: Record<string, ScheduleInstructor> = {}
  const photoSources: Record<string, string> = {}
  const classes = rows
    .map((c) => {
      const cap = typeof c.max_capacity === 'number' ? c.max_capacity : null
      const booked = typeof c.total_booked === 'number' ? c.total_booked : null
      const name = clean(c.name as string)
      const instructor = typeof c.hostName === 'string' ? (names.get(clean(c.hostName)) ?? clean(c.hostName)) : ''
      if (!(name in descriptions)) {
        const html = typeof c.descriptionHTML === 'string' && c.descriptionHTML ? simpleHtml(c.descriptionHTML) : ''
        const text = typeof c.description === 'string' ? clean(c.description) : ''
        if (html || text) descriptions[name] = html || `<p>${text.replace(/[&<>]/g, (ch) => `&#${ch.charCodeAt(0)};`)}</p>`
      }
      const host = Array.isArray(c.hostData) ? (c.hostData[0] as { about?: unknown; profileImageUrl?: unknown } | undefined) : undefined
      if (instructor && !(instructor in instructors)) {
        const bio = typeof host?.about === 'string' ? simpleHtml(host.about) : ''
        instructors[instructor] = { bio: bio || null, photo: null }
        if (typeof host?.profileImageUrl === 'string' && host.profileImageUrl.startsWith('https://')) photoSources[instructor] = host.profileImageUrl
      }
      return {
        id: c.id as string,
        name,
        start: new Date((c.start_time as number) * 1000).toISOString(),
        minutes: typeof c.duration === 'number' ? c.duration : 50,
        instructor,
        spotsLeft: cap !== null && booked !== null ? Math.max(0, cap - booked) : null,
        waitlist: typeof c.waitlistLength === 'number' ? c.waitlistLength : 0,
        canceled: c.canceled === true,
      }
    })
    .sort((a, b) => a.start.localeCompare(b.start))
  return { location, classes, descriptions, instructors, photoSources }
}

/** The New York midnight starting a YYYY-MM-DD date, as an ISO time. */
function nyMidnight(date: string): string {
  // Midnight in New York is 04:00 or 05:00 UTC; pick whichever lands on that date at 00:00 there.
  for (const h of [4, 5]) {
    const t = new Date(`${date}T0${h}:00:00.000Z`)
    if (t.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false }).startsWith('00:00')) return t.toISOString()
  }
  return new Date(`${date}T05:00:00.000Z`).toISOString()
}

/** The studio's classes from now to SCHEDULE_DAYS ahead. Throws when Arketa fails or changes shape. */
export async function fetchSchedule(location: Location, studio: string, now = new Date(), fetcher: typeof fetch = fetch): Promise<ReadSchedule> {
  const q = new URLSearchParams({
    startDateTime: nyMidnight(nyDate(now)),
    endDateTime: new Date(Date.parse(nyMidnight(nyDate(now, SCHEDULE_DAYS))) - 1000).toISOString(),
    timezone: 'America/New_York',
    locationId: ARKETA_LOCATIONS[location],
  })
  const res = await fetcher(`${WIDGET_API}/schedule?${q}`)
  if (!res.ok) throw new Error(`Arketa schedule: ${res.status}`)
  const schedule = scheduleFromReply(await res.json(), studio, now)
  if (!schedule) throw new Error('Arketa schedule: unexpected reply')
  return schedule
}
