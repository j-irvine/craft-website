// "Class schedule": the group class timetable for the two group classes pages, replacing Arketa's schedule
// embed, which lists the whole week at once and loads every instructor's full-size headshot (owners,
// 14 Nov 2026: the pages scroll for far too long). Read from the same undocumented API behind Arketa's own
// schedule widget as src/arketa.ts, and trimmed to what a client needs: no headshots, bios or capacity
// internals beyond spots left.

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
}

export interface Schedule {
  location: string
  classes: ScheduleClass[]
  readAt: string
}

/** Arketa's page for one class, where the client books it (or joins the waitlist), signing in there. */
export const checkoutUrl = (id: string) => `https://app.arketa.co/craftpilates/schedule/checkout/${id}`

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

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

/** The client-safe classes in one reply from Arketa's widget, or null when the reply isn't what we expect. */
export function classesFromReply(body: unknown, now = new Date()): ScheduleClass[] | null {
  const raw = (body as { data?: { classes?: unknown } } | null)?.data?.classes
  if (!Array.isArray(raw)) return null
  type Raw = {
    id?: unknown; name?: unknown; start_time?: unknown; duration?: unknown; hostName?: unknown; canceled?: unknown
    display?: unknown; experience_type?: unknown; max_capacity?: unknown; total_booked?: unknown; waitlistLength?: unknown
  }
  const rows = (raw as Raw[]).filter(
    (c) =>
      typeof c?.id === 'string' && typeof c.name === 'string' && typeof c.start_time === 'number' &&
      c.canceled !== true && (c.display ?? 'public') === 'public' && (c.experience_type ?? 'Class') === 'Class' &&
      !MEMBERS_ONLY.some((m) => clean(c.name as string).toLowerCase().includes(m)) &&
      (c.start_time as number) * 1000 > now.getTime(),
  )
  const names = shortNames(rows.map((c) => (typeof c.hostName === 'string' ? c.hostName : '')).filter(Boolean))
  return rows
    .map((c) => {
      const cap = typeof c.max_capacity === 'number' ? c.max_capacity : null
      const booked = typeof c.total_booked === 'number' ? c.total_booked : null
      return {
        id: c.id as string,
        name: clean(c.name as string),
        start: new Date((c.start_time as number) * 1000).toISOString(),
        minutes: typeof c.duration === 'number' ? c.duration : 50,
        instructor: typeof c.hostName === 'string' ? (names.get(clean(c.hostName)) ?? clean(c.hostName)) : '',
        spotsLeft: cap !== null && booked !== null ? Math.max(0, cap - booked) : null,
        waitlist: typeof c.waitlistLength === 'number' ? c.waitlistLength : 0,
      }
    })
    .sort((a, b) => a.start.localeCompare(b.start))
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
export async function fetchSchedule(location: Location, now = new Date(), fetcher: typeof fetch = fetch): Promise<ScheduleClass[]> {
  const q = new URLSearchParams({
    startDateTime: nyMidnight(nyDate(now)),
    endDateTime: new Date(Date.parse(nyMidnight(nyDate(now, SCHEDULE_DAYS))) - 1000).toISOString(),
    timezone: 'America/New_York',
    locationId: ARKETA_LOCATIONS[location],
  })
  const res = await fetcher(`${WIDGET_API}/schedule?${q}`)
  if (!res.ok) throw new Error(`Arketa schedule: ${res.status}`)
  const classes = classesFromReply(await res.json(), now)
  if (!classes) throw new Error('Arketa schedule: unexpected reply')
  return classes
}
