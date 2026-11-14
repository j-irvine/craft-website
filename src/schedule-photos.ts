// Small copies of the instructor headshots that the class schedule's "View Details" shows. Arketa only has the
// originals (up to 13 MB each), so each one is shrunk once to 120 px square (shown at 60) with Cloudflare's
// Images binding, kept in KV, and served by the Worker with a year's cache. A new photo in Arketa has a new
// address, so it gets a new copy. Until a copy is ready, the card shows the instructor's initials.

/** Bump to remake every copy (for example after changing the size). */
const VERSION = 1
/** Copies made per schedule request, in the background, so a cold start doesn't fetch 30 originals at once. */
const PER_REQUEST = 4
const INDEX = 'schedulePhotos'

/** A short, stable id for an Arketa photo: its storage path (the signed query string can change). */
export async function photoId(src: string): Promise<string> {
  const path = new URL(src).pathname
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${VERSION}:${path}`))
  return [...new Uint8Array(hash).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const photoPath = (id: string) => `/schedule-photos/${id}.jpg`

/**
 * Each instructor's small photo address (relative to the Worker), for those whose copy is ready, and a job that
 * makes a few of the missing ones (for ctx.waitUntil), or null when nothing is missing or there's no binding.
 */
export async function smallPhotos(
  kv: KVNamespace,
  images: ImagesBinding | undefined,
  sources: Record<string, string>,
): Promise<{ photos: Record<string, string>; job: Promise<void> | null }> {
  const ready = new Set((await kv.get<string[]>(INDEX, 'json')) ?? [])
  const photos: Record<string, string> = {}
  const missing: { id: string; src: string }[] = []
  for (const [name, src] of Object.entries(sources)) {
    const id = await photoId(src)
    if (ready.has(id)) photos[name] = photoPath(id)
    else if (!missing.some((m) => m.id === id)) missing.push({ id, src })
  }
  if (!images || !missing.length) return { photos, job: null }
  const job = (async () => {
    const made: string[] = []
    for (const { id, src } of missing.slice(0, PER_REQUEST)) {
      try {
        const res = await fetch(src)
        if (!res.ok || !res.body) throw new Error(String(res.status))
        const out = await images
          .input(res.body)
          .transform({ width: 120, height: 120, fit: 'cover', gravity: 'face' })
          .output({ format: 'image/jpeg', quality: 80 })
        await kv.put(`sphoto:${id}`, await out.response().arrayBuffer())
        made.push(id)
      } catch (e) {
        console.error('schedule photo', id, String(e))
      }
    }
    if (made.length) {
      const now = new Set((await kv.get<string[]>(INDEX, 'json')) ?? [])
      for (const id of made) now.add(id)
      await kv.put(INDEX, JSON.stringify([...now]))
    }
  })()
  return { photos, job }
}
