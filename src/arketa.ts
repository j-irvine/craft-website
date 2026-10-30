// Which instructors Arketa offers each privates service with, so an instructor's booking panel only has
// tabs for what they teach (an instructor who only does duets would otherwise get an empty Private calendar).
// Read from the public API behind Arketa's own booking widget. It's undocumented and unsupported, so when
// it fails or changes shape, the last good copy is kept, and without one every instructor gets both tabs.

import { ARKETA_SERVICES, LOCATIONS, type Location, type SessionType } from './instructors'

const WIDGET_API = 'https://widget-api-tkaeguucxq-uc.a.run.app/4l7q5eYxQYfsO5lsk9adVa8rRYC3'

/** Arketa service id to the instructor ("host") ids that offer it. */
export type ServiceHosts = Record<string, string[]>

/** Arketa instructor id to the name its booking pages show ("Abby", "Sarah K"), for matching them to the sheet. */
export type HostNames = Record<string, string>

/** One service's instructors, or null when the reply isn't what we expect. */
export function hostsFromReply(body: unknown): { id: string; name: string | null }[] | null {
  const instructors = (body as { instructors?: unknown } | null)?.instructors
  if (!Array.isArray(instructors)) return null
  const found = instructors.map((i) => i as { id?: unknown; name?: unknown })
  if (!found.every((i) => typeof i?.id === 'string')) return null
  return found.map((i) => ({ id: i.id as string, name: typeof i.name === 'string' ? i.name : null }))
}

/** Every privates service's instructors, and their names. Services that fail are left out. */
export async function fetchServiceHosts(fetcher: typeof fetch = fetch): Promise<{ hosts: ServiceHosts; names: HostNames; errors: string[] }> {
  const hosts: ServiceHosts = {}
  const names: HostNames = {}
  const errors: string[] = []
  const ids = Object.values(ARKETA_SERVICES).flatMap((s) => Object.values(s))
  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetcher(`${WIDGET_API}/services/${id}`)
        if (!res.ok) throw new Error(String(res.status))
        const found = hostsFromReply(await res.json())
        if (!found) throw new Error('unexpected reply')
        hosts[id] = found.map((h) => h.id)
        for (const h of found) if (h.name) names[h.id] = h.name
      } catch (e) {
        errors.push(`Arketa instructors for service ${id}: ${String(e)}`)
      }
    }),
  )
  return { hosts, names, errors }
}

/**
 * The session types an instructor offers at a studio. A service we couldn't read counts as offered.
 * Empty means Arketa has them on neither here.
 */
export function offeredTypes(hosts: ServiceHosts, location: Location, host: string): SessionType[] {
  return (['private', 'duet'] as const).filter((type) => {
    const ids = hosts[ARKETA_SERVICES[location][type]]
    return !ids || ids.includes(host)
  })
}

/** A place where the sheet and Arketa disagree about who does privates where. Usually a mistake to fix. */
export interface Mismatch {
  /** Stable while the mismatch lasts, so each one is emailed once. */
  key: string
  /** Who it's about, for the email's subject. */
  name: string
  message: string
}

const TYPE_NAMES: Record<SessionType, string> = { private: 'privates', duet: 'duets' }

/**
 * Who's on the website for a studio but not set up in Arketa there (or only for privates or only duets),
 * and who's set up in Arketa there but not on the website. Services we couldn't read are skipped.
 */
export function findMismatches(
  instructors: { name: string; locations: Location[]; arketaHost: string | null }[],
  hosts: ServiceHosts,
  names: HostNames,
): Mismatch[] {
  const out: Mismatch[] = []
  const known = Object.keys(names).length > 0
  for (const i of instructors) {
    if (!i.arketaHost) {
      if (known) out.push({ key: `unmatched:${i.name}`, name: i.name, message: `${i.name} is on the website, but no one with that name is set up for privates or duets in Arketa.` })
      continue
    }
    for (const location of i.locations) {
      const studio = LOCATIONS[location]
      const read = (['private', 'duet'] as const).filter((t) => hosts[ARKETA_SERVICES[location][t]])
      const has = read.filter((t) => hosts[ARKETA_SERVICES[location][t]].includes(i.arketaHost!))
      const missing = read.filter((t) => !has.includes(t))
      if (!missing.length) continue
      const message = has.length
        ? `${i.name} is set up in Arketa for ${studio} ${TYPE_NAMES[has[0]]} but not ${TYPE_NAMES[missing[0]]}.`
        : `${i.name} is on the website for ${studio}, but isn't set up in Arketa for ${studio} ${missing.map((t) => TYPE_NAMES[t]).join(' or ')}.`
      out.push({ key: `missing:${location}:${missing.join('+')}:${i.arketaHost}`, name: i.name, message })
    }
  }
  for (const location of Object.keys(LOCATIONS) as Location[]) {
    const studio = LOCATIONS[location]
    const onSite = new Set(instructors.filter((i) => i.locations.includes(location) && i.arketaHost).map((i) => i.arketaHost))
    const offers = new Map<string, SessionType[]>()
    for (const t of ['private', 'duet'] as const) {
      for (const h of hosts[ARKETA_SERVICES[location][t]] ?? []) offers.set(h, [...(offers.get(h) ?? []), t])
    }
    for (const [h, types] of offers) {
      if (onSite.has(h)) continue
      const name = names[h] ?? 'Someone without a name'
      out.push({
        key: `extra:${location}:${h}`,
        name,
        message: `${name} is set up in Arketa for ${studio} ${types.map((t) => TYPE_NAMES[t]).join(' and ')}, but isn't on the website for ${studio}.`,
      })
    }
  }
  return out
}

/**
 * Cards that need something from staff (owners, 30 Oct 2026): no photo in the folder, or no specialty
 * tags. Emailed with the mismatches above. Photos are skipped when they couldn't be read this run.
 */
export function cardIssues(instructors: { name: string; photo: string | null; specialties: unknown[] }[], photosRead: boolean): Mismatch[] {
  const out: Mismatch[] = []
  for (const i of instructors) {
    if (photosRead && !i.photo) {
      out.push({ key: `photo:${i.name}`, name: i.name, message: `${i.name} has no photo in the website photos folder, so the card shows the placeholder.` })
    }
    if (!i.specialties.length) {
      out.push({ key: `tags:${i.name}`, name: i.name, message: `${i.name} has no specialty tags (no client area marked "taught a few", "substantial experience" or "completed training" in the form), so ${i.name} doesn't show under any filter.` })
    }
  }
  return out
}
