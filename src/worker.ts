// The website's Worker: serves the embed script, the public instructor list, and a preview page.
// A cron re-reads the instructor sheet every 5 minutes and keeps the client-safe list in KV.

import { WIDGET_JS } from './generated/widget'
import { buildInstructors, candidateEmails, photoNames, forLocation, photoLinks, LOCATIONS, offeredSpecialties, type Location, type SheetResult } from './instructors'
import { parseServiceAccount, readSheet } from './google'
import { syncPhotos, type PhotoCounts } from './photos'
import { previewPage } from './preview'

export interface Env {
  DATA: KVNamespace
  /** Service account key JSON (secret). The sheet is shared with its email as Viewer. */
  GOOGLE_SERVICE_ACCOUNT: string
  /** The responses sheet's id, from its URL (secret, so it stays out of this public repo). */
  SHEET_ID: string
  SHEET_TAB: string
  /** The website-photos Drive folder's id (secret), shared with the service account as Viewer. Optional. */
  PHOTOS_FOLDER_ID?: string
}

interface Stored extends SheetResult {
  updatedAt: string
}

interface Status {
  updatedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  /** The latest run: when it started, the step it reached, and when it finished (null while running or if it was cut off). */
  lastRun?: { startedAt: string; step: string; finishedAt: string | null; photos?: PhotoCounts | 'no folder set' }
}

const json = (body: unknown, maxAge = 60) =>
  new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': `public, max-age=${maxAge}`,
    },
  })

export async function refresh(env: Env): Promise<void> {
  const status: Status = (await env.DATA.get<Status>('status', 'json')) ?? { updatedAt: null, lastError: null, lastErrorAt: null }
  // Each run says when it started and where it got to, and how many photos it found (counts only: file
  // names are emails). Two status writes a run; the account is on Workers Paid, well inside KV's limits.
  const run = { startedAt: new Date().toISOString(), step: 'sheet', finishedAt: null as string | null }
  await env.DATA.put('status', JSON.stringify({ ...status, lastRun: run }))
  const step = (name: string) => {
    run.step = name
  }
  let photoCounts: PhotoCounts | 'no folder set' | undefined = env.PHOTOS_FOLDER_ID ? undefined : 'no folder set'
  try {
    const sa = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT)
    if (!sa) throw new Error('GOOGLE_SERVICE_ACCOUNT is missing or not a service account key')
    const rows = await readSheet(sa, env.SHEET_ID, env.SHEET_TAB)
    let photos = new Map<string, string>()
    let photoErrors: string[] = []
    if (env.PHOTOS_FOLDER_ID) {
      step('photos')
      // Photos never hold up the list: a failure here shows as a warning, and cards keep the placeholder.
      try {
        ;({ photos, errors: photoErrors, counts: photoCounts } = await syncPhotos(env.DATA, sa, env.PHOTOS_FOLDER_ID, photoLinks(rows), candidateEmails(rows), photoNames(rows)))
      } catch (e) {
        photoErrors = [`Photos: ${String(e)}`]
      }
    }
    step('list')
    const result = await buildInstructors(rows, photos)
    result.warnings.push(...photoErrors.map((message) => ({ row: 0, message })))
    // KV's free tier allows 1,000 writes a day; only write when something changed.
    const previous = await env.DATA.get<Stored>('instructors', 'json')
    const same = previous && JSON.stringify([previous.instructors, previous.warnings]) === JSON.stringify([result.instructors, result.warnings])
    if (!same) await env.DATA.put('instructors', JSON.stringify({ ...result, updatedAt: new Date().toISOString() } satisfies Stored))
    await env.DATA.put('status', JSON.stringify({ ...status, lastError: null, lastRun: { ...run, step: 'done', finishedAt: new Date().toISOString(), photos: photoCounts } }))
  } catch (e) {
    const at = new Date().toISOString()
    await env.DATA.put('status', JSON.stringify({ ...status, lastError: String(e), lastErrorAt: at, lastRun: { ...run, finishedAt: at, photos: photoCounts } }))
    throw e
  }
}

const isLocation = (s: string | null): s is Location => s !== null && s in LOCATIONS

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })

    if (url.pathname === '/find-your-person.js') {
      return new Response(WIDGET_JS, {
        headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=300', 'access-control-allow-origin': '*' },
      })
    }

    const font = /^\/fonts\/(kk-topo|trio-grotesk-bold)\.woff2$/.exec(url.pathname)
    if (font) {
      // Uploaded once with scripts/upload-fonts.sh: the brand fonts stay out of this public repo.
      const data = await env.DATA.get(`font:${font[1]}`, 'arrayBuffer')
      if (!data) return new Response('Not found', { status: 404 })
      return new Response(data, {
        headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000', 'access-control-allow-origin': '*' },
      })
    }

    const photo = /^\/photos\/([0-9a-f]{12}-[\w-]{1,40}\.jpg)$/.exec(url.pathname)
    if (photo) {
      const data = await env.DATA.get(`photo:${photo[1]}`, 'arrayBuffer')
      if (!data) return new Response('Not found', { status: 404 })
      // Each version has its own name, so it can be cached for good.
      return new Response(data, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } })
    }

    if (url.pathname === '/api/instructors') {
      const location = url.searchParams.get('location')
      if (!isLocation(location)) return json({ error: 'location must be park-slope or uws' })
      const stored = await env.DATA.get<Stored>('instructors', 'json')
      const here = stored ? forLocation(stored.instructors, location) : []
      return json({
        location: LOCATIONS[location],
        specialties: offeredSpecialties(here),
        instructors: here.map(({ locations: _, ...i }) => i),
      })
    }

    if (url.pathname === '/api/status') {
      const stored = await env.DATA.get<Stored>('instructors', 'json')
      const status = await env.DATA.get<Status>('status', 'json')
      return json(
        {
          updatedAt: stored?.updatedAt ?? null,
          shown: stored ? Object.fromEntries(Object.keys(LOCATIONS).map((l) => [l, forLocation(stored.instructors, l as Location).length])) : null,
          sheetWarnings: stored?.warnings ?? [],
          lastError: status?.lastError ?? null,
          lastErrorAt: status?.lastErrorAt ?? null,
          lastRun: status?.lastRun ?? null,
        },
        0,
      )
    }

    if (url.pathname === '/preview') {
      const location = url.searchParams.get('location')
      return new Response(previewPage(isLocation(location) ? location : 'park-slope', url.origin), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
      })
    }

    return new Response('Not found', { status: 404 })
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refresh(env))
  },
} satisfies ExportedHandler<Env>
