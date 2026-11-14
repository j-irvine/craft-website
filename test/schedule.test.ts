import { describe, expect, it } from 'vitest'
import { classesFromReply, fetchSchedule, shortNames } from '../src/schedule'

const now = new Date('2026-11-14T12:00:00Z')
const cls = (over: Record<string, unknown>) => ({
  id: 'a', name: 'All Level', start_time: Date.parse('2026-11-14T15:00:00Z') / 1000, duration: 50, hostName: 'Rory',
  canceled: false, display: 'public', experience_type: 'Class', max_capacity: 9, total_booked: 7, waitlistLength: 0,
  hostData: [{ profileImageUrl: 'https://example.com/huge.jpg', about: 'bio' }],
  ...over,
})

describe('classesFromReply', () => {
  it('keeps what clients need and nothing else', () => {
    const out = classesFromReply({ data: { classes: [cls({ name: 'Next Level ' })] } }, now)
    expect(out).toEqual([{ id: 'a', name: 'Next Level', start: '2026-11-14T15:00:00.000Z', minutes: 50, instructor: 'Rory', spotsLeft: 2, waitlist: 0 }])
  })

  it('leaves out cancelled, private, members-only and past classes, and sorts by time', () => {
    const out = classesFromReply(
      {
        data: {
          classes: [
            cls({ id: 'late', start_time: Date.parse('2026-11-15T15:00:00Z') / 1000 }),
            cls({ id: 'early' }),
            cls({ id: 'x1', canceled: true }),
            cls({ id: 'x2', display: 'private' }),
            cls({ id: 'x3', name: 'Craft Circle' }),
            cls({ id: 'x4', start_time: Date.parse('2026-11-14T11:00:00Z') / 1000 }),
          ],
        },
      },
      now,
    )
    expect(out!.map((c) => c.id)).toEqual(['early', 'late'])
  })

  it('says a full class is full, with its waitlist', () => {
    const [c] = classesFromReply({ data: { classes: [cls({ total_booked: 9, waitlistLength: 2 })] } }, now)!
    expect(c.spotsLeft).toBe(0)
    expect(c.waitlist).toBe(2)
  })

  it('rejects a reply of another shape', () => {
    expect(classesFromReply({ classes: [] }, now)).toBeNull()
  })
})

describe('shortNames', () => {
  it('uses first names, with a last initial only when two share one', () => {
    const m = shortNames(['Keilaa-Demi De La Cruz', 'Morgan B', 'Morgan Miller', 'Sasha ', 'Sarah K'])
    expect(m.get('Keilaa-Demi De La Cruz')).toBe('Keilaa-Demi')
    expect(m.get('Morgan B')).toBe('Morgan B')
    expect(m.get('Morgan Miller')).toBe('Morgan M')
    expect(m.get('Sasha')).toBe('Sasha')
    expect(m.get('Sarah K')).toBe('Sarah K')
  })
})

describe('fetchSchedule', () => {
  it('asks for two weeks from New York midnight at that studio', async () => {
    let asked = ''
    const fetcher = (async (u: string) => {
      asked = u
      return new Response(JSON.stringify({ data: { classes: [] } }))
    }) as unknown as typeof fetch
    await fetchSchedule('park-slope', now, fetcher)
    const q = new URL(asked).searchParams
    expect(q.get('startDateTime')).toBe('2026-11-14T05:00:00.000Z')
    expect(q.get('endDateTime')).toBe('2026-11-28T04:59:59.000Z')
    expect(q.get('locationId')).toBe('67ptpiCjvCsriKuEdItN')
  })
})
