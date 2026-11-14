// How the class schedule reaches visitors without waiting on Arketa, whose 12-week read takes 3 to 5 seconds
// (owners, 14 Nov 2026: "Why does it take so long to load the schedule?"). Each request is answered from the
// last read: this data center's edge cache, else the copy in KV that the cron writes every 15 minutes. When
// that read is over a minute old, a new one is made in the background for the next visitor. Only when there's
// no copy at all (a new deploy before the first cron) does a visitor wait for Arketa.

import { fetchSchedule, type Schedule } from './schedule'
import { smallPhotos } from './schedule-photos'
import { LOCATIONS, type Location } from './instructors'

interface Env {
  DATA: KVNamespace
  IMAGES?: ImagesBinding
}

/** A schedule as kept: photo addresses relative to the Worker, and when it was read. */
export interface KeptSchedule extends Schedule {
  readAt: string
}

/** Older than this, a request starts a new read in the background. */
export const FRESH_MS = 60_000
const kvKey = (location: Location) => `schedule:${location}`
const cacheKey = (location: Location) => new Request(`https://schedule.cache/${location}`)
const edge = () => (caches as unknown as { default: Cache }).default
/** Reads under way in this isolate, so a burst of visitors starts one. */
const reading = new Map<Location, Promise<KeptSchedule>>()

/** Reads the schedule from Arketa, with small photos for those ready (and makes a few more). */
async function read(env: Env, location: Location): Promise<{ kept: KeptSchedule; photoJob: Promise<void> | null }> {
  const { photoSources, ...schedule } = await fetchSchedule(location, LOCATIONS[location])
  const { photos, job } = await smallPhotos(env.DATA, env.IMAGES, photoSources)
  for (const [name, path] of Object.entries(photos)) if (schedule.instructors[name]) schedule.instructors[name].photo = path
  return { kept: { ...schedule, readAt: new Date().toISOString() }, photoJob: job }
}

const toEdge = (kept: KeptSchedule) =>
  new Response(JSON.stringify(kept), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' } })

/** A new read, put in the edge cache. One at a time per studio in this isolate. */
function reread(env: Env, ctx: ExecutionContext, location: Location): Promise<KeptSchedule> {
  const running = reading.get(location)
  if (running) return running
  const p = (async () => {
    const { kept, photoJob } = await read(env, location)
    if (photoJob) ctx.waitUntil(photoJob)
    await edge().put(cacheKey(location), toEdge(kept))
    return kept
  })().finally(() => reading.delete(location))
  reading.set(location, p)
  return p
}

/** The schedule to answer with now; starts a background read when it's stale. */
export async function servedSchedule(env: Env, ctx: ExecutionContext, location: Location, now = Date.now()): Promise<KeptSchedule> {
  let kept: KeptSchedule | null = null
  const hit = await edge().match(cacheKey(location))
  if (hit) kept = await hit.json<KeptSchedule>()
  else kept = await env.DATA.get<KeptSchedule>(kvKey(location), 'json')
  if (!kept) return reread(env, ctx, location)
  if (now - Date.parse(kept.readAt) > FRESH_MS) {
    ctx.waitUntil(reread(env, ctx, location).catch((e) => console.error('schedule reread', String(e))))
  }
  return kept
}

/** The cron's copy of each studio's schedule in KV (a failed read leaves the last one). */
export async function keepSchedule(env: Env): Promise<void> {
  for (const location of Object.keys(LOCATIONS) as Location[]) {
    try {
      const { kept, photoJob } = await read(env, location)
      await env.DATA.put(kvKey(location), JSON.stringify(kept))
      if (photoJob) await photoJob
    } catch (e) {
      console.error('schedule keep', location, String(e))
    }
  }
}

/** The schedule for the page: photo addresses made absolute, and no read time. */
export function withOrigin(kept: KeptSchedule, origin: string): Schedule {
  const { readAt: _readAt, ...schedule } = kept
  const instructors = Object.fromEntries(
    Object.entries(schedule.instructors).map(([name, i]) => [name, { ...i, photo: i.photo ? `${origin}${i.photo}` : null }]),
  )
  return { ...schedule, instructors }
}
