import { describe, expect, it } from 'vitest'
import { fetchSchedule, scheduleFromReply, shortNames, simpleHtml } from '../src/schedule'

const now = new Date('2026-11-14T12:00:00Z')
const cls = (over: Record<string, unknown>) => ({
  id: 'a', name: 'All Level', start_time: Date.parse('2026-11-14T15:00:00Z') / 1000, duration: 50, hostName: 'Rory',
  canceled: false, display: 'public', experience_type: 'Class', service_id: 'svc', max_capacity: 9, total_booked: 7, waitlistLength: 0,
  descriptionHTML: '<p><b><strong style="white-space: pre-wrap;">All Level</strong></b><span> is for every body.</span></p><p><br></p>',
  hostData: [{ profileImageUrl: 'https://example.com/huge.jpg', about: '<p><span style="x">Rory teaches.</span></p>' }],
  ...over,
})
const read = (classes: unknown[]) => scheduleFromReply({ data: { classes } }, 'Park Slope', now)!

describe('scheduleFromReply', () => {
  it('keeps what clients need, with descriptions and bios once each', () => {
    const s = read([cls({ name: 'Next Level ' }), cls({ id: 'b', name: 'Next Level' })])
    expect(s.classes[0]).toEqual({ id: 'a', name: 'Next Level', typeId: 'svc', start: '2026-11-14T15:00:00.000Z', minutes: 50, instructor: 'Rory', spotsLeft: 2, waitlist: 0, canceled: false })
    expect(s.descriptions).toEqual({ 'Next Level': '<p><b><strong>All Level</strong></b> is for every body.</p>' })
    expect(s.instructors).toEqual({ Rory: { bio: '<p>Rory teaches.</p>', photo: null } })
    expect(s.photoSources).toEqual({ Rory: 'https://example.com/huge.jpg' })
  })

  it('leaves out private, members-only and past classes, keeps cancelled ones marked, and sorts by time', () => {
    const s = read([
      cls({ id: 'late', start_time: Date.parse('2026-11-15T15:00:00Z') / 1000 }),
      cls({ id: 'early' }),
      cls({ id: 'off', canceled: true }),
      cls({ id: 'x2', display: 'private' }),
      cls({ id: 'x3', name: 'Craft Circle' }),
      cls({ id: 'x4', start_time: Date.parse('2026-11-14T11:00:00Z') / 1000 }),
    ])
    expect(s.classes.map((c) => c.id)).toEqual(['early', 'off', 'late'])
    expect(s.classes.find((c) => c.id === 'off')!.canceled).toBe(true)
  })

  it('says a full class is full, with its waitlist', () => {
    const [c] = read([cls({ total_booked: 9, waitlistLength: 2 })]).classes
    expect(c.spotsLeft).toBe(0)
    expect(c.waitlist).toBe(2)
  })

  it('rejects a reply of another shape', () => {
    expect(scheduleFromReply({ classes: [] }, 'Park Slope', now)).toBeNull()
  })
})

describe('simpleHtml', () => {
  it('keeps paragraphs, bold and lists, and drops everything else', () => {
    expect(simpleHtml('<p onclick="x()">Hi <a href="javascript:x">there</a><img src=x onerror=y></p><script>bad()</script><ul><li style="c">One</li></ul>'))
      .toBe('<p>Hi there</p><ul><li>One</li></ul>')
  })
  it('escapes a stray angle bracket', () => {
    expect(simpleHtml('<p>1 < 2</p>')).toBe('<p>1 &lt; 2</p>')
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
    await fetchSchedule('park-slope', 'Park Slope', now, fetcher)
    const q = new URL(asked).searchParams
    expect(q.get('startDateTime')).toBe('2026-11-14T05:00:00.000Z')
    expect(q.get('endDateTime')).toBe('2026-11-28T04:59:59.000Z')
    expect(q.get('locationId')).toBe('67ptpiCjvCsriKuEdItN')
  })
})
