// The website's Worker: serves the embed script, the public instructor list, and a preview page.
// A cron re-reads the instructor sheet every 5 minutes and keeps the client-safe list in KV.

import { WIDGET_JS } from './generated/widget'
import { buildInstructors, forLocation, LOCATIONS, SPECIALTIES, type Location, type SheetResult } from './instructors'
import { parseServiceAccount, readSheet } from './google'
import { previewPage } from './preview'

export interface Env {
  DATA: KVNamespace
  /** Service account key JSON (secret). The sheet is shared with its email as Viewer. */
  GOOGLE_SERVICE_ACCOUNT: string
  /** The responses sheet's id, from its URL (secret, so it stays out of this public repo). */
  SHEET_ID: string
  SHEET_TAB: string
}

interface Stored extends SheetResult {
  updatedAt: string
}

interface Status {
  updatedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
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
  try {
    const sa = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT)
    if (!sa) throw new Error('GOOGLE_SERVICE_ACCOUNT is missing or not a service account key')
    const rows = await readSheet(sa, env.SHEET_ID, env.SHEET_TAB)
    const result = await buildInstructors(rows)
    // KV's free tier allows 1,000 writes a day; only write when something changed.
    const previous = await env.DATA.get<Stored>('instructors', 'json')
    const same = previous && JSON.stringify([previous.instructors, previous.warnings]) === JSON.stringify([result.instructors, result.warnings])
    if (!same) await env.DATA.put('instructors', JSON.stringify({ ...result, updatedAt: new Date().toISOString() } satisfies Stored))
    if (status.lastError) await env.DATA.put('status', JSON.stringify({ ...status, lastError: null }))
  } catch (e) {
    await env.DATA.put('status', JSON.stringify({ ...status, lastError: String(e), lastErrorAt: new Date().toISOString() }))
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

    if (url.pathname === '/api/instructors') {
      const location = url.searchParams.get('location')
      if (!isLocation(location)) return json({ error: 'location must be park-slope or uws' })
      const stored = await env.DATA.get<Stored>('instructors', 'json')
      return json({
        location: LOCATIONS[location],
        specialties: SPECIALTIES.map(({ key, label }) => ({ key, label })),
        instructors: stored ? forLocation(stored.instructors, location).map(({ locations: _, ...i }) => i) : [],
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
