import { describe, expect, it } from 'vitest'
import { findMismatches } from '../src/arketa'
import { EMPTY_STATE, nextAlerts } from '../src/alerts'
import { ARKETA_SERVICES } from '../src/instructors'

const PS = ARKETA_SERVICES['park-slope']
const UWS = ARKETA_SERVICES.uws

describe('findMismatches', () => {
  const hosts = { [PS.private]: ['abby', 'alex', 'laura'], [PS.duet]: ['abby', 'laura', 'rory'], [UWS.private]: ['abby'], [UWS.duet]: ['abby'] }
  const names = { abby: 'Abby', alex: 'Alex', laura: 'Laura', rory: 'Rory' }

  it('finds both directions, and privates or duets only', () => {
    const found = findMismatches(
      [
        { name: 'Abby', locations: ['park-slope', 'uws'], arketaHost: 'abby' },
        { name: 'Alex', locations: ['park-slope', 'uws'], arketaHost: 'alex' },
        { name: 'Sierra', locations: ['park-slope'], arketaHost: null },
      ],
      hosts,
      names,
    ).map((m) => m.message)
    expect(found).toEqual([
      'Alex is set up in Arketa for Park Slope privates but not duets.',
      "Alex is on the website for Upper West Side, but isn't set up in Arketa for Upper West Side privates or duets.",
      'Sierra is on the website, but no one with that name is set up for privates or duets in Arketa.',
      "Laura is set up in Arketa for Park Slope privates and duets, but isn't on the website for Park Slope.",
      "Rory is set up in Arketa for Park Slope duets, but isn't on the website for Park Slope.",
    ])
  })

  it("skips services it couldn't read, and names before Arketa was ever read", () => {
    expect(findMismatches([{ name: 'Sierra', locations: ['uws'], arketaHost: null }, { name: 'Abby', locations: ['uws'], arketaHost: 'abby' }], { [UWS.private]: ['abby'] }, {})).toEqual([])
  })
})

describe('nextAlerts', () => {
  const m = [{ key: 'a', message: 'Alex is set up in Arketa for Park Slope privates but not duets.' }]
  const t = (iso: string) => new Date(iso)

  it('emails a mismatch once it has lasted an hour, and only once', () => {
    const first = nextAlerts(EMPTY_STATE, m, false, t('2026-10-30T14:00:00Z'))
    expect(first.email).toBeNull()
    expect(nextAlerts(first.state, m, false, t('2026-10-30T14:30:00Z')).email).toBeNull()
    const sent = nextAlerts(first.state, m, false, t('2026-10-30T15:00:00Z'))
    expect(sent.email?.subject).toBe('Find Your Person: 1 thing to check between the sheet and Arketa')
    expect(sent.email?.text).toContain('- Alex is set up in Arketa for Park Slope privates but not duets.')
    expect(nextAlerts(sent.state, m, false, t('2026-10-30T16:00:00Z')).email).toBeNull()
  })

  it('forgets a mismatch fixed within the hour', () => {
    const first = nextAlerts(EMPTY_STATE, m, false, t('2026-10-30T14:00:00Z'))
    const fixed = nextAlerts(first.state, [], false, t('2026-10-30T14:20:00Z'))
    expect(fixed.state.open).toEqual({})
    expect(nextAlerts(fixed.state, [], false, t('2026-10-30T16:00:00Z')).email).toBeNull()
  })

  it('reminds on Monday mornings while any are open, once a week', () => {
    const first = nextAlerts(EMPTY_STATE, m, false, t('2026-10-30T14:00:00Z'))
    const sent = nextAlerts(first.state, m, false, t('2026-10-30T15:00:00Z'))
    // Monday 2 Nov, 8:55 am and 9:05 am in New York (EST).
    expect(nextAlerts(sent.state, m, false, t('2026-11-02T13:55:00Z')).email).toBeNull()
    const reminder = nextAlerts(sent.state, m, false, t('2026-11-02T14:05:00Z'))
    expect(reminder.email?.text).toContain('Still open (1):')
    expect(nextAlerts(reminder.state, m, false, t('2026-11-02T14:10:00Z')).email).toBeNull()
  })

  it("keeps everything for later when it can't send", () => {
    const first = nextAlerts(EMPTY_STATE, m, false, t('2026-10-30T14:00:00Z'), false)
    const later = nextAlerts(first.state, m, false, t('2026-10-30T15:00:00Z'), false)
    expect(later.email).toBeNull()
    expect(nextAlerts(later.state, m, false, t('2026-10-30T15:05:00Z')).email).not.toBeNull()
  })

  it("emails once when Arketa can't be read for a day", () => {
    const first = nextAlerts(EMPTY_STATE, [], true, t('2026-10-30T14:00:00Z'))
    expect(nextAlerts(first.state, [], true, t('2026-10-31T13:00:00Z')).email).toBeNull()
    const sent = nextAlerts(first.state, [], true, t('2026-10-31T14:00:00Z'))
    expect(sent.email?.subject).toBe("Find Your Person: can't check Arketa")
    expect(nextAlerts(sent.state, [], true, t('2026-10-31T15:00:00Z')).email).toBeNull()
  })
})
