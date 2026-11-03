// Each instructor's soonest open private or duet time at each studio, so the directory can lead with whoever
// a client can book soonest (owners asked, 3 Nov 2026). Read from the same undocumented API behind Arketa's
// own booking widget as src/arketa.ts: one call for which days have times, then one per day with times,
// which lists every instructor's slots that day. When it fails, the last good copy is kept, and without one
// the list stays alphabetical.

import { WIDGET_API } from './arketa'
import { ARKETA_LOCATIONS, ARKETA_SERVICES, LOCATIONS, type Location } from './instructors'

/** Per studio, Arketa instructor id to their soonest open time (ISO, UTC). Anyone with none is left out. */
export type Soonest = Record<Location, Record<string, string>>

/** What's kept in KV: each studio's last good read, and when it was read. */
export type StoredSoonest = Partial<Record<Location, { readAt: string; times: Record<string, string> }>>

/** How often to read it (each read is a few dozen requests), and how long a last good copy is still used. */
export const REFRESH_MINUTES = 15
export const STALE_HOURS = 6

/** A studio's times to sort by, or undefined (alphabetical) when there's no read or it's older than STALE_HOURS. */
export function usableSoonest(stored: StoredSoonest | null, location: Location, now = new Date()): Record<string, string> | undefined {
  const entry = stored?.[location]
  if (!entry || now.getTime() - Date.parse(entry.readAt) > STALE_HOURS * 3_600_000) return undefined
  return entry.times
}

/** Whether it's time to read again: REFRESH_MINUTES since the oldest studio's read. */
export function soonestDue(stored: StoredSoonest | null, now = new Date()): boolean {
  return (Object.keys(LOCATIONS) as Location[]).some((l) => {
    const at = stored?.[l]?.readAt
    return !at || now.getTime() - Date.parse(at) >= (REFRESH_MINUTES - 1) * 60_000
  })
}

/** How far ahead to look. Further out than this, the instructor counts as having nothing. */
export const LOOKAHEAD_DAYS = 14

/** The studio's local date `days` from `now`, as YYYY-MM-DD. */
export function nyDate(now: Date, days = 0): string {
  return new Date(now.getTime() + days * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** The days Arketa says have open times, or null when the reply isn't what we expect. */
export function daysFromReply(body: unknown): string[] | null {
  if (!Array.isArray(body)) return null
  if (!body.every((d) => typeof d?.date === 'string')) return null
  return body.filter((d) => d.isAvailable === true).map((d) => (d.date as string).slice(0, 10))
}

/** Each instructor's earliest open time in one day's reply, or null when the reply isn't what we expect. */
export function timesFromReply(body: unknown): Record<string, string> | null {
  const slots = (body as { slots?: unknown } | null)?.slots
  if (!Array.isArray(slots)) return null
  const out: Record<string, string> = {}
  for (const slot of slots) {
    const times = (slot as { startTimes?: unknown })?.startTimes
    if (!Array.isArray(times)) return null
    for (const t of times as { instructorId?: unknown; dateString?: unknown }[]) {
      const host = typeof t?.instructorId === 'string' ? t.instructorId : (slot as { instructorId?: unknown }).instructorId
      if (typeof host !== 'string' || typeof t?.dateString !== 'string' || Number.isNaN(Date.parse(t.dateString))) continue
      const at = new Date(t.dateString).toISOString()
      if (!out[host] || at < out[host]) out[host] = at
    }
  }
  return out
}

/**
 * Everyone's soonest open time at each studio, privates and duets together, from now to LOOKAHEAD_DAYS ahead.
 * `hosts` is who teaches each service (from fetchServiceHosts): a day stops being read once all of them have
 * a time, since days come in order. A studio that fails is left out, and its error returned.
 */
export async function fetchSoonest(
  hosts: Record<string, string[]>,
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<{ soonest: Partial<Soonest>; errors: string[]; requests: number }> {
  const soonest: Partial<Soonest> = {}
  const errors: string[] = []
  let requests = 0
  const get = async (url: string) => {
    requests++
    const res = await fetcher(url)
    if (!res.ok) throw new Error(String(res.status))
    return res.json()
  }
  const base = (service: string) => `${WIDGET_API}/services/${service}`
  for (const location of Object.keys(LOCATIONS) as Location[]) {
    try {
      const found: Record<string, string> = {}
      for (const service of Object.values(ARKETA_SERVICES[location])) {
        const common = { instructorId: 'any', locationId: ARKETA_LOCATIONS[location], roomId: '', timezone: 'America/New_York' }
        const days = daysFromReply(await get(`${base(service)}/availableDays?${new URLSearchParams({ ...common, startDate: nyDate(now), endDate: nyDate(now, LOOKAHEAD_DAYS) })}`))
        if (!days) throw new Error('unexpected reply for days')
        const teachers = hosts[service]
        for (const date of days) {
          const times = timesFromReply(await get(`${base(service)}/availableTimes?${new URLSearchParams({ ...common, date, noClasses: 'true' })}`))
          if (!times) throw new Error('unexpected reply for times')
          for (const [host, at] of Object.entries(times)) {
            if (Date.parse(at) <= now.getTime()) continue
            if (!found[host] || at < found[host]) found[host] = at
          }
          // Later days can't beat a time found on this day or before (some may be from the other service),
          // so stop once everyone who teaches this has one.
          if (teachers?.length && teachers.every((h) => found[h] && nyDate(new Date(found[h])) <= date)) break
        }
      }
      soonest[location] = found
    } catch (e) {
      errors.push(`Arketa availability at ${LOCATIONS[location]}: ${String(e)}`)
    }
  }
  return { soonest, errors, requests }
}

/**
 * Soonest open time first; anyone with nothing in the next LOOKAHEAD_DAYS (or not matched to Arketa) after,
 * alphabetically. Without any availability read for the studio, the order stays alphabetical.
 */
export function bySoonest<T extends { name: string; arketaHost: string | null }>(instructors: T[], soonest: Record<string, string> | undefined): T[] {
  if (!soonest) return instructors
  const at = (i: T) => (i.arketaHost && soonest[i.arketaHost]) || '￿'
  return [...instructors].sort((a, b) => at(a).localeCompare(at(b)) || a.name.localeCompare(b.name))
}
