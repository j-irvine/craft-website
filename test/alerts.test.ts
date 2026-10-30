import { describe, expect, it } from 'vitest'
import { cardIssues, findMismatches } from '../src/arketa'
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
    )
    expect(found.map((m) => m.name)).toEqual(['Alex', 'Alex', 'Sierra', 'Laura', 'Rory'])
    expect(found.map((m) => m.message)).toEqual([
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

describe('cardIssues', () => {
  it('flags no photo and no tags, and skips photos it could not read', () => {
    const people = [
      { name: 'Ana', photo: null, specialties: [] },
      { name: 'Bea', photo: '/photos/x.jpg', specialties: ['teens'] },
    ]
    expect(cardIssues(people, true).map((m) => m.key)).toEqual(['photo:Ana', 'tags:Ana'])
    expect(cardIssues(people, false).map((m) => m.key)).toEqual(['tags:Ana'])
  })
})

describe('nextAlerts', () => {
  const m = [{ key: 'a', name: 'Alex', message: 'Alex is set up in Arketa for Park Slope privates but not duets.' }]
  const t = (iso: string) => new Date(iso)

  it('emails a mismatch once it has lasted an hour, and only once', () => {
    const first = nextAlerts(EMPTY_STATE, m, false, t('2026-10-30T14:00:00Z'))
    expect(first.email).toBeNull()
    expect(nextAlerts(first.state, m, false, t('2026-10-30T14:30:00Z')).email).toBeNull()
    const sent = nextAlerts(first.state, m, false, t('2026-10-30T15:00:00Z'))
    expect(sent.email?.subject).toBe('Please fix: website privates for Alex')
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
    expect(reminder.email?.text).toContain("need fixing")
    expect(nextAlerts(reminder.state, m, false, t('2026-11-02T14:10:00Z')).email).toBeNull()
  })

  it('sends the whole list at once when asked, even before the hour or with nothing open', () => {
    const first = nextAlerts(EMPTY_STATE, m, false, t('2026-10-30T14:00:00Z'), true, true)
    expect(first.email?.text).toContain('- Alex is set up')
    expect(nextAlerts(first.state, m, false, t('2026-10-30T15:05:00Z')).email).toBeNull()
    expect(nextAlerts(EMPTY_STATE, [], false, t('2026-10-30T14:00:00Z'), true, true).email?.subject).toBe('Privates booking: the instructor sheet and Arketa match')
  })

  it('names up to three people in the subject', () => {
    const many = ['Alex', 'Alyssa', 'Julianna', 'Katie', 'Lydia'].map((name) => ({ key: name, name, message: `${name} …` }))
    const sent = nextAlerts(EMPTY_STATE, many, false, t('2026-10-30T14:00:00Z'), true, true)
    expect(sent.email?.subject).toBe('Please fix: website privates for Alex, Alyssa, Julianna and 2 others')
  })

  it('keeps open ones this run could not check', () => {
    const first = nextAlerts(EMPTY_STATE, m, false, t('2026-10-30T14:00:00Z'))
    expect(Object.keys(nextAlerts(first.state, [], false, t('2026-10-30T14:05:00Z'), true, false, (k) => k === 'a').state.open)).toEqual(['a'])
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
    expect(sent.email?.subject).toBe("Please check: the website can't read Arketa's privates")
    expect(nextAlerts(sent.state, [], true, t('2026-10-31T15:00:00Z')).email).toBeNull()
  })
})
