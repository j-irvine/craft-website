import { describe, expect, it, vi, beforeEach } from 'vitest'
import { servedSchedule, withOrigin, type KeptSchedule } from '../src/schedule-cache'

const kept = (readAt: string): KeptSchedule => ({
  location: 'Park Slope', classes: [], descriptions: {}, readAt,
  instructors: { Ana: { bio: null, photo: '/schedule-photos/abc.jpg' }, Bo: { bio: null, photo: null } },
})

let store: Map<string, Response>
beforeEach(() => {
  store = new Map()
  ;(globalThis as unknown as { caches: unknown }).caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    },
  }
})

const env = (kv: KeptSchedule | null) => ({ DATA: { get: vi.fn(async () => kv) } as unknown as KVNamespace })
const ctx = () => ({ waitUntil: vi.fn((p: Promise<unknown>) => void p.catch(() => {})) }) as unknown as ExecutionContext

describe('servedSchedule', () => {
  it('answers from KV at once and re-reads in the background when stale', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const c = ctx()
    const now = Date.parse('2026-11-14T20:00:00Z')
    const got = await servedSchedule(env(kept('2026-11-14T19:50:00Z')), c, 'park-slope', now)
    expect(got.readAt).toBe('2026-11-14T19:50:00Z')
    expect(c.waitUntil).toHaveBeenCalledTimes(1)
    fetchSpy.mockRestore()
  })

  it('prefers the edge copy and leaves a fresh one alone', async () => {
    store.set('https://schedule.cache/park-slope', new Response(JSON.stringify(kept('2026-11-14T19:59:30Z'))))
    const c = ctx()
    const e = env(kept('2026-11-14T19:00:00Z'))
    const got = await servedSchedule(e, c, 'park-slope', Date.parse('2026-11-14T20:00:00Z'))
    expect(got.readAt).toBe('2026-11-14T19:59:30Z')
    expect(e.DATA.get).not.toHaveBeenCalled()
    expect(c.waitUntil).not.toHaveBeenCalled()
  })
})

describe('withOrigin', () => {
  it('makes photo addresses absolute and drops the read time', () => {
    const s = withOrigin(kept('x'), 'https://w.example')
    expect(s.instructors.Ana.photo).toBe('https://w.example/schedule-photos/abc.jpg')
    expect(s.instructors.Bo.photo).toBeNull()
    expect('readAt' in s).toBe(false)
  })
})
