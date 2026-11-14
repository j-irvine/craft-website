import { afterEach, describe, expect, it, vi } from 'vitest'
import { photoId, smallPhotos } from '../src/schedule-photos'

const kv = () => {
  const m = new Map<string, unknown>()
  return {
    m,
    get: async (k: string, t?: string) => (m.has(k) ? (t === 'json' ? JSON.parse(m.get(k) as string) : m.get(k)) : null),
    put: async (k: string, v: unknown) => void m.set(k, v),
  } as unknown as KVNamespace & { m: Map<string, unknown> }
}
const images = {
  input: () => ({ transform: () => ({ output: async () => ({ response: () => new Response('small') }) }) }),
} as unknown as ImagesBinding

afterEach(() => vi.unstubAllGlobals())

describe('smallPhotos', () => {
  it('makes missing copies in the background, then serves them', async () => {
    vi.stubGlobal('fetch', async () => new Response('huge'))
    const store = kv()
    const src = { Rory: 'https://storage.googleapis.com/x/users/a/files/rory.jpg?Signature=1' }
    const first = await smallPhotos(store, images, src)
    expect(first.photos).toEqual({})
    await first.job
    const id = await photoId(src.Rory)
    expect(store.m.has(`sphoto:${id}`)).toBe(true)
    // A new signature on the same file is the same photo.
    const again = await smallPhotos(store, images, { Rory: src.Rory.replace('Signature=1', 'Signature=2') })
    expect(again.photos).toEqual({ Rory: `/schedule-photos/${id}.jpg` })
    expect(again.job).toBeNull()
  })

  it('does nothing without the Images binding', async () => {
    const r = await smallPhotos(kv(), undefined, { Rory: 'https://example.com/a.jpg' })
    expect(r).toEqual({ photos: {}, job: null })
  })
})
