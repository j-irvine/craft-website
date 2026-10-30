import { describe, expect, it } from 'vitest'
import { arketaBookingUrl, arketaHostId, arketaSessions, matchArketaHost, buildInstructors, candidateEmails, driveFileId, forLocation, nameKey, offeredSpecialties, parseLocations, parseYears, photoLinks, photoNames, yearsLabel } from '../src/instructors'
import { hostsFromReply, offeredTypes } from '../src/arketa'
import { choosePhotos, emailFromName, photoOwner } from '../src/photos'

// The real form's headers (29 Oct 2026), plus the columns being added. Rows below are made up.
const AREAS = [
  'Beginners or returning after a break',
  'Strength and athletic performance',
  'Pregnancy',
  'Postpartum',
  'Older adults, balance and mobility',
  'Teens',
  'Low bone density, including osteoporosis',
  'Hypermobility and joint stability',
  'Returning after injury or managing physical limitations',
  'Sciatica',
  'Herniated or bulging discs',
  'Other back injuries or persistent back pain',
  'Scoliosis',
  'Arthritis and other joint conditions',
  'Shoulder, hip or knee injuries',
  'Returning after surgery or joint replacement',
  'Neurological conditions affecting movement or balance',
]
const HEADER = [
  'Timestamp',
  'Email Address',
  'Your name',
  'How many years have you taught Pilates? An estimate is fine.',
  'Are you currently interested in taking private clients at Craft?',
  'Where did you complete your Pilates certification? Please include the name of the program or studio and the certification(s) you earned.',
  'Which Pilates equipment are you qualified to teach?',
  'If you selected other, please specify here ',
  ...AREAS.map((a) => `For each client area select all that apply [${a}]`),
  'Are there any other conditions, injuries or physical limitations you have experience teaching clients with?',
  'Any additional training relevant to these areas? ',
  'Anything else you would like us to know when matching you with private clients? ',
  'Which locations are you available for privates?',
  'Short bio for the website',
  'Hide from website',
  'Arketa booking link',
]

type Opts = Partial<{
  time: string
  email: string
  name: string
  years: string
  privates: string
  cert: string
  areas: Record<string, string>
  notes: string
  location: string
  bio: string
  hide: string
  arketa: string
}>

function row(o: Opts): unknown[] {
  return [
    o.time ?? '10/1/2026 10:00:00',
    o.email ?? 'ana@example.com',
    o.name ?? 'Ana Rivera',
    o.years ?? '5',
    o.privates ?? 'Yes',
    o.cert ?? 'BASI Comprehensive',
    'Reformer',
    '',
    ...AREAS.map((a) => o.areas?.[a] ?? ''),
    o.notes ?? 'private note',
    'private training',
    'private matching note',
    o.location ?? 'Park Slope',
    o.bio ?? '',
    o.hide ?? 'FALSE',
    o.arketa ?? '',
  ]
}

const build = (...rows: Opts[]) => buildInstructors([HEADER, ...rows.map(row)])

describe('parseYears', () => {
  it.each([
    ['11.0', 11],
    ['2.5', 2.5],
    ['A year and a half', 1.5],
    ['2 + years', 2],
    ['Two years', 2],
    ['<1', 0.5],
    ['3 years ', 3],
    ['10 yrs ', 10],
    ['full time for 2', 2],
    ['', null],
    ['a while', null],
  ])('%s', (raw, years) => expect(parseYears(raw)).toBe(years))
})

describe('yearsLabel', () => {
  it('words years for the card, from 3 years', () => {
    expect(yearsLabel(0.5)).toBeNull()
    expect(yearsLabel(2.5)).toBeNull()
    expect(yearsLabel(3)).toBe('3 years teaching')
    expect(yearsLabel(3.5)).toBe('3+ years teaching')
    expect(yearsLabel(10)).toBe('10 years teaching')
  })
})

describe('parseLocations', () => {
  it('reads both studios', () => {
    expect(parseLocations('Park Slope, UWS')).toEqual(['park-slope', 'uws'])
    expect(parseLocations('Upper West Side')).toEqual(['uws'])
    expect(parseLocations('')).toEqual([])
  })
})

describe('offeredSpecialties', () => {
  it('offers only chips someone at that studio has', async () => {
    const { instructors } = await build(
      { email: 'a@x.com', name: 'Ana', location: 'Park Slope', areas: { Teens: 'Completed relevant training' } },
      { email: 'b@x.com', name: 'Bea', location: 'UWS', areas: { Sciatica: 'Completed relevant training' } },
    )
    expect(offeredSpecialties(forLocation(instructors, 'park-slope')).map((s) => s.key)).toEqual(['teens'])
    expect(offeredSpecialties(forLocation(instructors, 'uws')).map((s) => s.label)).toEqual(['Back pain'])
  })
})

describe('buildInstructors', () => {
  it('publishes only client-safe fields', async () => {
    const { instructors } = await build({ notes: 'SECRET' })
    expect(instructors).toHaveLength(1)
    const json = JSON.stringify(instructors)
    expect(json).not.toContain('ana@example.com')
    expect(json).not.toContain('SECRET')
    expect(json).not.toContain('Rivera')
    expect(instructors[0]).toMatchObject({ name: 'Ana', locations: ['park-slope'], yearsLabel: '5 years teaching' })
  })

  it('tags a specialty for any teaching experience or completed training', async () => {
    const { instructors } = await build({
      areas: {
        Pregnancy: 'Completed relevant training',
        Teens: 'Have taught a few clients in this group, Interested in teaching this group',
        Sciatica: 'Have substantial teaching experience with this group',
        'Strength and athletic performance': 'Interested in teaching this group',
        'Neurological conditions affecting movement or balance': 'Have not taught yet',
      },
    })
    expect(instructors[0].specialties).toEqual(['pregnancy', 'teens', 'back'])
  })

  it('uses the latest response per email', async () => {
    const { instructors } = await build(
      { time: '9/1/2026 10:00:00', email: 'Ana@Example.com', years: '2' },
      { time: '10/1/2026 10:00:00', email: 'ana@example.com', years: '3' },
    )
    expect(instructors).toHaveLength(1)
    expect(instructors[0].yearsLabel).toBe('3 years teaching')
  })

  it('hides checked rows and people not taking privates', async () => {
    const { instructors } = await build(
      { email: 'a@x.com', hide: 'TRUE' },
      { email: 'b@x.com', name: 'Bea', privates: 'Not currently' },
      { email: 'c@x.com', name: 'Cleo' },
    )
    expect(instructors.map((i) => i.name)).toEqual(['Cleo'])
  })

  it('adds a last initial when first names clash', async () => {
    const { instructors } = await build(
      { email: 'a@x.com', name: 'Sarah King' },
      { email: 'b@x.com', name: 'Sarah Lee' },
      { email: 'c@x.com', name: 'Mia Chen' },
    )
    expect(instructors.map((i) => i.name)).toEqual(['Mia', 'Sarah K', 'Sarah L'])
  })

  it('filters by location and warns about rows staff should fix', async () => {
    const { instructors, warnings } = await build(
      { email: 'a@x.com', name: 'Ana', location: 'Park Slope, UWS' },
      { email: 'b@x.com', name: 'Bea', location: 'UWS', years: 'a while' },
      { email: 'c@x.com', name: 'Cleo', location: '' },
    )
    expect(forLocation(instructors, 'uws').map((i) => i.name)).toEqual(['Ana', 'Bea'])
    expect(forLocation(instructors, 'park-slope').map((i) => i.name)).toEqual(['Ana'])
    expect(warnings.map((w) => w.row)).toEqual([3, 4])
  })
})

describe('photos', () => {
  it('reads Drive ids from share links', () => {
    expect(driveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS/view?usp=sharing')).toBe('1AbCdEfGhIjKlMnOpQrS')
    expect(driveFileId('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrS')).toBe('1AbCdEfGhIjKlMnOpQrS')
    expect(driveFileId('not a link')).toBeNull()
  })

  it('names photos by email', () => {
    expect(emailFromName('Ana@Example.com.JPG')).toBe('ana@example.com')
    expect(emailFromName('ana@example.com')).toBe('ana@example.com')
    expect(emailFromName('IMG_1234.jpg')).toBeNull()
  })

  it('prefers professional photos, then emailed ones, then the row link', () => {
    const img = (id: string, name: string) => ({ id, name, mimeType: 'image/jpeg' })
    const chosen = choosePhotos(
      [img('pro', 'a@x.com.jpg')],
      [img('mail-a', 'a@x.com.jpg'), img('mail-b', 'b@x.com.heic'), { id: 'f', name: 'c@x.com', mimeType: 'application/vnd.google-apps.folder' }],
      new Map([['b@x.com', 'link-b'], ['c@x.com', 'link-c']]),
    )
    expect(Object.fromEntries(chosen)).toEqual({ 'a@x.com': 'pro', 'b@x.com': 'mail-b', 'c@x.com': 'link-c' })
  })

  it('collects photo links and candidates from the latest responses', async () => {
    const header = [...HEADER, 'Photo link']
    const rows = [
      header,
      [...row({ email: 'a@x.com' }), 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS/view'],
      [...row({ email: 'b@x.com', privates: 'Not currently' }), ''],
      [...row({ email: 'c@x.com', hide: 'TRUE' }), ''],
    ]
    expect(Object.fromEntries(photoLinks(rows))).toEqual({ 'a@x.com': '1AbCdEfGhIjKlMnOpQrS' })
    expect(candidateEmails(rows)).toEqual(['a@x.com'])
  })

  it('matches photos named by full name', () => {
    const header = HEADER
    const rows = [
      header,
      row({ email: 'a@x.com', name: 'Zoë  Martín-Ruiz' }),
      row({ email: 'b@x.com', name: 'Sam Lee' }),
      row({ email: 'c@x.com', name: 'Sam Lee' }),
      row({ email: 'd@x.com', name: 'Dee Not', privates: 'Not currently' }),
    ]
    const names = photoNames(rows)
    expect(nameKey('Zoë  Martín-Ruiz')).toBe('zoe martin ruiz')
    expect(photoOwner('zoe martin-ruiz.JPG', names)).toBe('a@x.com')
    expect(photoOwner('Sam Lee.jpg', names)).toBeNull()
    expect(photoOwner('Dee Not.jpg', names)).toBeNull()
    expect(photoOwner('a@x.com.png', names)).toBe('a@x.com')
    const chosen = choosePhotos([], [{ id: 'z', name: 'Zoe Martin Ruiz.heic', mimeType: 'image/heif' }], new Map(), names)
    expect(Object.fromEntries(chosen)).toEqual({ 'a@x.com': 'z' })
  })
})

describe('Arketa booking', () => {
  const link = 'https://app.arketa.co/iframe/craftpilates/privates/by-service?host=LtWx0pB3l0PROXKmxGCUpTcB4EA2'
  it('reads the instructor id from the link, the embed code, or the bare id', () => {
    expect(arketaHostId(link)).toBe('LtWx0pB3l0PROXKmxGCUpTcB4EA2')
    expect(arketaHostId(`<iframe id="sutraWidgetIframe" src="${link}" width="100%"></iframe>`)).toBe('LtWx0pB3l0PROXKmxGCUpTcB4EA2')
    expect(arketaHostId(' LtWx0pB3l0PROXKmxGCUpTcB4EA2 ')).toBe('LtWx0pB3l0PROXKmxGCUpTcB4EA2')
    expect(arketaHostId('ask Maayan')).toBeNull()
    expect(arketaHostId('')).toBeNull()
  })

  it("narrows Arketa's page to the studio, and to the instructor when known", () => {
    expect(arketaBookingUrl('park-slope', 'LtWx0pB3l0PROXKmxGCUpTcB4EA2')).toBe(
      'https://app.arketa.co/iframe/craftpilates/privates/by-service?host=LtWx0pB3l0PROXKmxGCUpTcB4EA2&location=67ptpiCjvCsriKuEdItN',
    )
    expect(arketaBookingUrl('uws', null)).toBe('https://app.arketa.co/iframe/craftpilates/privates/by-service?location=N80JtYm27xFQhqhv8wam')
  })

  it("keeps each instructor's id, and warns about a link it can't read", async () => {
    const { instructors, warnings } = await build({ arketa: link }, { email: 'bo@example.com', name: 'Bo Li', arketa: 'see Arketa' })
    expect(instructors.map((i) => [i.name, i.arketaHost])).toEqual([
      ['Ana', 'LtWx0pB3l0PROXKmxGCUpTcB4EA2'],
      ['Bo', null],
    ])
    expect(warnings.map((w) => w.message)).toEqual(["Couldn't read the Arketa booking link, so Book opens the studio's calendar"])
  })
})

describe('Private and Duet calendars', () => {
  it('link straight to each calendar, Private first, for one instructor or any', () => {
    expect(arketaSessions('uws', 'LtWx0pB3l0PROXKmxGCUpTcB4EA2')).toEqual([
      {
        type: 'private',
        label: 'Private',
        url: 'https://app.arketa.co/iframe/craftpilates/privates/by-service/qm64gHeSlUrvjQSAiLpe/location?instructorId=LtWx0pB3l0PROXKmxGCUpTcB4EA2&locationId=N80JtYm27xFQhqhv8wam',
      },
      {
        type: 'duet',
        label: 'Duet',
        url: 'https://app.arketa.co/iframe/craftpilates/privates/by-service/dS81rRoLiWfJSzTJlw5s/location?instructorId=LtWx0pB3l0PROXKmxGCUpTcB4EA2&locationId=N80JtYm27xFQhqhv8wam',
      },
    ])
    expect(arketaSessions('park-slope', null, ['duet']).map((x) => x.url)).toEqual([
      'https://app.arketa.co/iframe/craftpilates/privates/by-service/44ToNiZDKxDKpmC8IXnf/location?instructorId=any&locationId=67ptpiCjvCsriKuEdItN',
    ])
  })

  it("offers only the types Arketa has the instructor on, and both when a service couldn't be read", () => {
    const hosts = { W6jMmZalGy1q2aEynEMt: ['a'], '44ToNiZDKxDKpmC8IXnf': ['a', 'b'] }
    expect(offeredTypes(hosts, 'park-slope', 'a')).toEqual(['private', 'duet'])
    expect(offeredTypes(hosts, 'park-slope', 'b')).toEqual(['duet'])
    expect(offeredTypes(hosts, 'park-slope', 'c')).toEqual([])
    expect(offeredTypes({}, 'uws', 'c')).toEqual(['private', 'duet'])
  })

  it("reads instructor ids from Arketa's reply, and rejects a reply that changed shape", () => {
    expect(hostsFromReply({ service: {}, instructors: [{ id: 'a', name: 'Abby' }, { id: 'b' }] })).toEqual([
      { id: 'a', name: 'Abby' },
      { id: 'b', name: null },
    ])
    expect(hostsFromReply({ instructors: [{ name: 'Abby' }] })).toBeNull()
    expect(hostsFromReply({ items: [] })).toBeNull()
    expect(hostsFromReply(null)).toBeNull()
  })
})

describe('matching instructors to Arketa by name', () => {
  const arketa = { a1: 'Abby', s1: 'Sarah K', s2: 'Sarah D', l1: 'Lauren Moss', m1: 'Maya', m2: 'maya' }
  const people = [
    { first: 'Abby', last: 'Lee-Zampi' },
    { first: 'Sarah', last: 'Kim' },
    { first: 'Sarah', last: 'Diaz' },
    { first: 'Lauren', last: 'Moss' },
    { first: 'Maya', last: 'Ortiz' },
    { first: 'Zoe', last: 'Park' },
  ]
  const match = (i: number) => matchArketaHost(people[i], people, arketa)
  it('matches a full name, a first name, or a first name and initial', () => {
    expect(match(0)).toBe('a1')
    expect(match(1)).toBe('s1')
    expect(match(2)).toBe('s2')
    expect(match(3)).toBe('l1')
  })
  it('matches nobody when Arketa has the name twice or not at all', () => {
    expect(match(4)).toBeNull()
    expect(match(5)).toBeNull()
  })
  it("doesn't give a shared first name to one of the two", () => {
    expect(matchArketaHost({ first: 'Sarah', last: 'Kim' }, people, { x: 'Sarah' })).toBeNull()
  })
  it('lets a pasted link win, and says who has no match', async () => {
    const link = 'https://app.arketa.co/iframe/craftpilates/privates/by-service?host=LtWx0pB3l0PROXKmxGCUpTcB4EA2'
    const rows = [HEADER, row({ name: 'Ana Rivera', arketa: link }), row({ email: 'bo@example.com', name: 'Bo Li' }), row({ email: 'cy@example.com', name: 'Cy Ng' })]
    const { instructors, warnings } = await buildInstructors(rows, new Map(), { a: 'Ana', b: 'Bo' })
    expect(instructors.map((i) => [i.name, i.arketaHost])).toEqual([
      ['Ana', 'LtWx0pB3l0PROXKmxGCUpTcB4EA2'],
      ['Bo', 'b'],
      ['Cy', null],
    ])
    expect(warnings).toEqual([{ row: 4, message: expect.stringContaining('No instructor with this name') }])
  })
})
