// Which instructors Arketa offers each privates service with, so an instructor's booking panel only has
// tabs for what they teach (an instructor who only does duets would otherwise get an empty Private calendar).
// Read from the public API behind Arketa's own booking widget. It's undocumented and unsupported, so when
// it fails or changes shape, the last good copy is kept, and without one every instructor gets both tabs.

import { ARKETA_SERVICES, type Location, type SessionType } from './instructors'

const WIDGET_API = 'https://widget-api-tkaeguucxq-uc.a.run.app/4l7q5eYxQYfsO5lsk9adVa8rRYC3'

/** Arketa service id to the instructor ("host") ids that offer it. */
export type ServiceHosts = Record<string, string[]>

/** One service's instructors, or null when the reply isn't what we expect. */
export function hostsFromReply(body: unknown): string[] | null {
  const instructors = (body as { instructors?: unknown } | null)?.instructors
  if (!Array.isArray(instructors)) return null
  const ids = instructors.map((i) => (i as { id?: unknown })?.id).filter((id): id is string => typeof id === 'string')
  return ids.length === instructors.length ? ids : null
}

/** Every privates service's instructors. Services that fail are left out. */
export async function fetchServiceHosts(fetcher: typeof fetch = fetch): Promise<{ hosts: ServiceHosts; errors: string[] }> {
  const hosts: ServiceHosts = {}
  const errors: string[] = []
  const ids = Object.values(ARKETA_SERVICES).flatMap((s) => Object.values(s))
  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetcher(`${WIDGET_API}/services/${id}`)
        if (!res.ok) throw new Error(String(res.status))
        const found = hostsFromReply(await res.json())
        if (!found) throw new Error('unexpected reply')
        hosts[id] = found
      } catch (e) {
        errors.push(`Arketa instructors for service ${id}: ${String(e)}`)
      }
    }),
  )
  return { hosts, errors }
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
