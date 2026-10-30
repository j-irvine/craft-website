// Emails staff when the sheet and Arketa disagree about who does privates where (owners, 30 Oct 2026:
// usually a mistake to track down; it needn't be fast, but it mustn't go unnoticed). Each disagreement is
// emailed once it has lasted an hour (so a sheet mid-edit doesn't send one), and while any are left, a
// reminder with all of them goes out each Monday morning. Nothing is sent without RESEND_API_KEY and ALERT_EMAIL.

import type { Mismatch } from './arketa'

/** Long enough for someone to finish editing the sheet or Arketa. */
const SETTLE_MS = 60 * 60 * 1000
/** Arketa's instructor lists failing this long is itself worth an email: until it's fixed, nothing is checked. */
const READ_FAILURE_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

interface Open {
  message: string
  since: string
  emailed: boolean
}

export interface AlertState {
  open: Record<string, Open>
  lastReminder: string | null
  /** When reading Arketa's instructors started failing, while it is. */
  readFailingSince: string | null
  readFailureEmailed: boolean
}

export const EMPTY_STATE: AlertState = { open: {}, lastReminder: null, readFailingSince: null, readFailureEmailed: false }

export interface Email {
  subject: string
  text: string
}

/**
 * The next state and the email to send now, if any. `readFailed` is whether this run couldn't read Arketa
 * (the mismatches then come from the last good copy). `canSend` false only tracks them. Mondays from 9 am New York time count for the reminder.
 */
export function nextAlerts(state: AlertState, mismatches: Mismatch[], readFailed: boolean, now: Date, canSend = true): { state: AlertState; email: Email | null } {
  const at = now.toISOString()
  const next: AlertState = { ...state, open: { ...state.open } }
  if (readFailed) {
    next.readFailingSince ??= at
  } else {
    next.readFailingSince = null
    next.readFailureEmailed = false
  }
  const current = new Set(mismatches.map((m) => m.key))
  for (const key of Object.keys(next.open)) if (!current.has(key)) delete next.open[key]
  for (const m of mismatches) next.open[m.key] ??= { message: m.message, since: at, emailed: false }

  const settled = Object.entries(next.open).filter(([, o]) => now.getTime() - Date.parse(o.since) >= SETTLE_MS)
  const fresh = settled.filter(([, o]) => !o.emailed)
  const readProblem = next.readFailingSince !== null && !next.readFailureEmailed && now.getTime() - Date.parse(next.readFailingSince) >= READ_FAILURE_MS
  const reminderDue = settled.length > 0 && isMondayMorning(now) && (!next.lastReminder || now.getTime() - Date.parse(next.lastReminder) >= WEEK_MS - 12 * 60 * 60 * 1000)
  // Without a way to send, nothing is marked as emailed, so it all goes out once one is set up.
  if (!canSend || (!fresh.length && !readProblem && !reminderDue)) return { state: next, email: null }

  for (const [key, o] of settled) next.open[key] = { ...o, emailed: true }
  if (readProblem) next.readFailureEmailed = true
  if (reminderDue) next.lastReminder = at

  const freshKeys = new Set(fresh.map(([key]) => key))
  const older = settled.filter(([key]) => !freshKeys.has(key))
  const lines: string[] = []
  if (readProblem) {
    lines.push("The website hasn't been able to read Arketa's privates instructors for a day, so it can't check them against the sheet. Booking still works from the last good copy.", '')
  }
  if (fresh.length) {
    lines.push(fresh.length === 1 ? 'New since the last email:' : `New since the last email (${fresh.length}):`, ...fresh.map(([, o]) => `- ${o.message}`), '')
  }
  if (older.length) {
    lines.push(fresh.length ? 'Still open:' : `Still open (${older.length}):`, ...older.map(([, o]) => `- ${o.message}`), '')
  }
  if (settled.length) {
    lines.push(
      "Each of these is usually a mistake, either in the instructor sheet (privates answer, locations, Hide from website) or in which Private and Duet services the instructor is on in Arketa. Once the two agree, it drops off this list by itself.",
      '',
      'Someone at a studio on the website who has no Arketa calendar there gets a message to email hello@craftpilates.com instead of a booking calendar.',
    )
  }
  const count = settled.length
  const subject = readProblem && !count
    ? "Find Your Person: can't check Arketa"
    : `Find Your Person: ${count} ${count === 1 ? 'thing' : 'things'} to check between the sheet and Arketa`
  return { state: next, email: { subject, text: lines.join('\n').trim() } }
}

function isMondayMorning(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now)
  const weekday = parts.find((p) => p.type === 'weekday')?.value
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  return weekday === 'Mon' && hour >= 9
}

/** Sends through Resend, from the studio's own address (verified there for the studio app). */
export async function sendEmail(apiKey: string, to: string, email: Email, fetcher: typeof fetch = fetch): Promise<void> {
  const res = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'Craft Pilates website <hello@craftpilates.com>', to: to.split(',').map((s) => s.trim()), subject: email.subject, text: email.text }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
}
