// Which instructors Arketa offers each privates service with, so an instructor's booking panel only has
// tabs for what they teach (an instructor who only does duets would otherwise get an empty Private calendar).
// Read from the public API behind Arketa's own booking widget. It's undocumented and unsupported, so when
// it fails or changes shape, the last good copy is kept, and without one every instructor gets both tabs.

import { ARKETA_SERVICES, type Location, type SessionType } from './instructors'

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
