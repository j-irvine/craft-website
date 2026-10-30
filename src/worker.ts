// The website's Worker: serves the embed script, the public instructor list, and a preview page.
// A cron re-reads the instructor sheet every 5 minutes and keeps the client-safe list in KV.

import { WIDGET_JS } from './generated/widget'
import { arketaBookingUrl, arketaSessions, buildInstructors, candidateEmails, photoNames, forLocation, photoLinks, LOCATIONS, offeredSpecialties, type Location, type SheetResult } from './instructors'
import { parseServiceAccount, readSheet } from './google'
import { cardIssues, fetchServiceHosts, findMismatches, offeredTypes, type HostNames, type ServiceHosts } from './arketa'
import { EMPTY_STATE, nextAlerts, sendEmail, type AlertState } from './alerts'
import { syncPhotos, type PhotoCounts } from './photos'
import { previewPage } from './preview'
import PLACEHOLDER from '../assets/placeholder.jpg'

export interface Env {
  DATA: KVNamespace
  /** Service account key JSON (secret). The sheet is shared with its email as Viewer. */
  GOOGLE_SERVICE_ACCOUNT: string
  /** The responses sheet's id, from its URL (secret, so it stays out of this public repo). */
  SHEET_ID: string
  SHEET_TAB: string
  /** The website-photos Drive folder's id (secret), shared with the service account as Viewer. Optional. */
  PHOTOS_FOLDER_ID?: string
  /** Resend key that can send email (secret). With ALERT_EMAIL, staff are emailed when the sheet and Arketa disagree. */
  RESEND_API_KEY?: string
  /** Who gets those emails (secret, comma-separated), so addresses stay out of this public repo. */
  ALERT_EMAIL?: string
}

interface Stored extends SheetResult {
  updatedAt: string
}

interface Status {
  updatedAt: string | null
  /** How many disagreements between the sheet and Arketa the last run found (emailed to staff). */
  mismatches?: number
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
    step('arketa')
    // Which instructors offer privates and duets, for their booking tabs. A failure keeps the last good copy.
    const { hosts, names, errors: arketaErrors } = await fetchServiceHosts()
    const previousHosts = (await env.DATA.get<ServiceHosts>('arketaHosts', 'json')) ?? {}
    const mergedHosts = { ...previousHosts, ...hosts }
    if (JSON.stringify(mergedHosts) !== JSON.stringify(previousHosts)) await env.DATA.put('arketaHosts', JSON.stringify(mergedHosts))
    const previousNames = (await env.DATA.get<HostNames>('arketaNames', 'json')) ?? {}
    // A complete read replaces the names, so instructors who left Arketa stop matching; a partial one adds to them.
    const mergedNames = arketaErrors.length ? { ...previousNames, ...names } : names
    if (JSON.stringify(mergedNames) !== JSON.stringify(previousNames)) await env.DATA.put('arketaNames', JSON.stringify(mergedNames))
    step('list')
    const result = await buildInstructors(rows, photos, mergedNames)
    result.warnings.push(...photoErrors.map((message) => ({ row: 0, message })))
    result.warnings.push(...arketaErrors.map((message) => ({ row: 0, message })))
    // KV's free tier allows 1,000 writes a day; only write when something changed.
    const previous = await env.DATA.get<Stored>('instructors', 'json')
    const same = previous && JSON.stringify([previous.instructors, previous.warnings]) === JSON.stringify([result.instructors, result.warnings])
    if (!same) await env.DATA.put('instructors', JSON.stringify({ ...result, updatedAt: new Date().toISOString() } satisfies Stored))
    step('alerts')
    const mismatches = findMismatches(result.instructors, mergedHosts, mergedNames)
    const photosRead = Boolean(env.PHOTOS_FOLDER_ID) && photoErrors.length === 0
    await alertStaff(env, [...mismatches, ...cardIssues(result.instructors, photosRead)], arketaErrors.length > 0, photosRead)
    await env.DATA.put('status', JSON.stringify({ ...status, mismatches: mismatches.length, lastError: null, lastRun: { ...run, step: 'done', finishedAt: new Date().toISOString(), photos: photoCounts } }))
  } catch (e) {
    const at = new Date().toISOString()
    await env.DATA.put('status', JSON.stringify({ ...status, lastError: String(e), lastErrorAt: at, lastRun: { ...run, finishedAt: at, photos: photoCounts } }))
    throw e
  }
}

/** Emails staff about disagreements between the sheet and Arketa (src/alerts.ts). Never fails the run. */
async function alertStaff(env: Env, mismatches: ReturnType<typeof findMismatches>, readFailed: boolean, photosRead: boolean) {
  try {
    const previous = (await env.DATA.get<AlertState>('alerts', 'json')) ?? EMPTY_STATE
    // Put there by the "Send alerts now" GitHub action, for the whole list at once.
    const sendNow = (await env.DATA.get('alerts:send-now')) !== null
    const { state, email } = nextAlerts(previous, mismatches, readFailed, new Date(), Boolean(env.RESEND_API_KEY && env.ALERT_EMAIL), sendNow, (key) => !photosRead && key.startsWith('photo:'))
    // Saved only once the email is sent, so a failed send is tried again next run.
    if (email) await sendEmail(env.RESEND_API_KEY!, env.ALERT_EMAIL!, email)
    if (JSON.stringify(state) !== JSON.stringify(previous)) await env.DATA.put('alerts', JSON.stringify(state))
    if (sendNow && email) await env.DATA.delete('alerts:send-now')
  } catch (e) {
    console.error('alerts', e)
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

    // Cards without a photo yet (owners' choice, Oct 30: the studio's socks shot).
    if (url.pathname === '/placeholder.jpg') {
      return new Response(PLACEHOLDER, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } })
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
      const hosts = (await env.DATA.get<ServiceHosts>('arketaHosts', 'json')) ?? {}
      const names = (await env.DATA.get<HostNames>('arketaNames', 'json')) ?? {}
      const here = stored ? forLocation(stored.instructors, location) : []
      // Only the tabs an instructor teaches here. None (not set up here in Arketa) says to email the studio;
      // null (Arketa's instructors never read) falls back to Arketa's picker.
      const known = Object.keys(names).length > 0
      const sessions = (host: string | null) => (host ? arketaSessions(location, host, offeredTypes(hosts, location, host)) : known ? [] : null)
      return json({
        location: LOCATIONS[location],
        specialties: offeredSpecialties(here),
        // Booking any instructor at this studio, and each instructor's own times here.
        // Arketa's page where the client picks any instructor, and the calendars for any instructor.
        booking: arketaBookingUrl(location, null),
        sessions: arketaSessions(location, null),
        // Each instructor's own calendars here.
        instructors: here.map(({ locations: _, arketaHost, ...i }) => ({ ...i, sessions: sessions(arketaHost) })),
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
          arketaMismatches: status?.mismatches ?? null,
          alertsEmail: Boolean(env.RESEND_API_KEY && env.ALERT_EMAIL),
          lastError: status?.lastError ?? null,
          lastErrorAt: status?.lastErrorAt ?? null,
          lastRun: status?.lastRun ?? null,
        },
        0,
      )
    }

    if (url.pathname === '/preview') {
      const location = url.searchParams.get('location')
      return new Response(previewPage(isLocation(location) ? location : 'park-slope', url.origin, undefined, '', url.searchParams.get('booking') === 'panel'), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
      })
    }

    return new Response('Not found', { status: 404 })
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refresh(env))
  },
} satisfies ExportedHandler<Env>
