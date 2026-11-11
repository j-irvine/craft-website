import { describe, expect, it } from 'vitest'
import { bySoonest, daysFromReply, fetchSoonest, nyDate, soonestDue, timesFromReply, usableSoonest } from '../src/availability'
import { ARKETA_SERVICES } from '../src/instructors'

// Shapes as Arketa's widget API returned them on 3 Nov 2026; ids and times made up.
const slot = (host: string, ...times: string[]) => ({
  type: 'instructor',
  instructorId: host,
  instructorName: host,
  startTimes: times.map((t) => ({ label: '', dateString: t, instructorId: host })),
})

describe('replies', () => {
  it('reads the open days', () => {
    expect(
      daysFromReply([
        { date: '2026-11-04T00:00:00-05:00', isAvailable: false, unavailableReason: 'booking_window_closed' },
        { date: '2026-11-05T00:00:00-05:00', isAvailable: true },
      ]),
    ).toEqual(['2026-11-05'])
    expect(daysFromReply({ message: 'Sorry' })).toBeNull()
  })

  it("takes each instructor's earliest time in a day", () => {
    expect(timesFromReply({ slots: [slot('a', '2026-11-05T19:00:00.000Z', '2026-11-05T18:00:00.000Z'), slot('b')] })).toEqual({ a: '2026-11-05T18:00:00.000Z' })
    expect(timesFromReply({ message: 'Sorry' })).toBeNull()
  })
})

describe('fetchSoonest', () => {
  const now = new Date('2026-11-03T21:00:00Z')
  // Park Slope: private has a on the 6th and b on the 9th; duet has c on the 4th and a on the 5th. UWS fails.
  const ps = ARKETA_SERVICES['park-slope']
  const days: Record<string, string[]> = { [ps.private]: ['2026-11-06', '2026-11-09', '2026-11-10'], [ps.duet]: ['2026-11-04', '2026-11-05', '2026-11-12'] }
  const times: Record<string, Record<string, ReturnType<typeof slot>[]>> = {
    [ps.private]: { '2026-11-06': [slot('a', '2026-11-06T18:00:00.000Z')], '2026-11-09': [slot('b', '2026-11-09T15:00:00.000Z')] },
    [ps.duet]: { '2026-11-04': [slot('c', '2026-11-04T23:00:00.000Z')], '2026-11-05': [slot('a', '2026-11-05T16:00:00.000Z')] },
  }
  const fetcher = (async (input: string) => {
    const url = new URL(input)
    const service = url.pathname.split('/')[3]
    if (!(service in days)) return new Response('no', { status: 500 })
    if (url.pathname.endsWith('/availableDays')) return Response.json(days[service].map((d) => ({ date: `${d}T00:00:00-05:00`, isAvailable: true })))
    return Response.json({ slots: times[service][url.searchParams.get('date')!] ?? [] })
  }) as typeof fetch

  it('finds the soonest time across privates and duets, and stops reading days once everyone has one', async () => {
    const { soonest, errors, requests } = await fetchSoonest({ [ps.private]: ['a', 'b'], [ps.duet]: ['a'] }, now, fetcher)
    expect(soonest['park-slope']).toEqual({ a: '2026-11-05T16:00:00.000Z', b: '2026-11-09T15:00:00.000Z', c: '2026-11-04T23:00:00.000Z' })
    expect(soonest.uws).toBeUndefined()
    expect(errors).toHaveLength(1)
    // Private: days + 6th + 9th (not the 10th). Duet: days + 4th + 5th (a's 6th from privates doesn't stop
    // it after the 4th, but its 5th does, so not the 12th). UWS: one failed call.
    expect(requests).toBe(7)
  })
})

describe('ordering', () => {
  const people = [
    { name: 'Abby', arketaHost: 'a' },
    { name: 'Laura', arketaHost: 'l' },
    { name: 'Marija', arketaHost: null },
    { name: 'Sarah K', arketaHost: 's' },
  ]

  it('shows only instructors with an open time, soonest first', () => {
    expect(bySoonest(people, { s: '2026-11-05T16:00:00.000Z', a: '2026-11-06T16:00:00.000Z' }).map((p) => p.name)).toEqual(['Sarah K', 'Abby'])
  })

  it('shows everyone alphabetically without a read', () => {
    expect(bySoonest(people, undefined).map((p) => p.name)).toEqual(['Abby', 'Laura', 'Marija', 'Sarah K'])
  })

  it('shows everyone when the read has nobody with a time, rather than an empty directory', () => {
    expect(bySoonest(people, {}).map((p) => p.name)).toEqual(['Abby', 'Laura', 'Marija', 'Sarah K'])
    expect(bySoonest(people, { other: '2026-11-05T16:00:00.000Z' }).map((p) => p.name)).toEqual(['Abby', 'Laura', 'Marija', 'Sarah K'])
  })

  it('ignores a read older than 6 hours, and is due again after 15 minutes', () => {
    const now = new Date('2026-11-03T21:00:00Z')
    const stored = { 'park-slope': { readAt: '2026-11-03T14:00:00Z', times: {} }, uws: { readAt: '2026-11-03T20:50:00Z', times: {} } }
    expect(usableSoonest(stored, 'park-slope', now)).toBeUndefined()
    expect(usableSoonest(stored, 'uws', now)).toEqual({})
    expect(soonestDue(stored, now)).toBe(true)
    expect(soonestDue({ ...stored, 'park-slope': stored.uws }, now)).toBe(false)
    expect(soonestDue(null, now)).toBe(true)
  })

  it("uses the studio's date", () => {
    expect(nyDate(new Date('2026-11-04T03:00:00Z'))).toBe('2026-11-03')
  })
})
