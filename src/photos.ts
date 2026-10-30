// Instructor photos: copied from the private website-photos Drive folder into KV and served by the
// Worker, so the page never loads Drive links. Files are named by the instructor's form email
// ("ana@example.com.jpg") or full name as in the form ("Ana Rivera.jpg", owners, Oct 30); a "Professional" subfolder holds shoot photos, which win; a row's
// "Photo link" covers photos the bot couldn't name by form email. Google resizes them (the Drive
// thumbnail at PHOTO_SIZE px, always JPEG, so iPhone HEIC photos work); the card crops with CSS.

import { accessToken, FETCH_TIMEOUT_MS, type ServiceAccount } from './google'
import { instructorId, nameKey } from './instructors'

export const PHOTO_SIZE = 900
const PRO_FOLDER = 'professional'
/** New photos copied per run, so a big first batch is spread over a few runs instead of one long one. */
export const DOWNLOADS_PER_RUN = 6

export interface DriveFile {
  id: string
  name: string
  md5Checksum?: string
  mimeType: string
}

const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp)$/i

/** The email a photo file is named for: its name without the extension, lowercased. */
export function emailFromName(name: string): string | null {
  const base = name.trim().toLowerCase().replace(IMAGE_EXT, '')
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(base) ? base : null
}

/** Whose photo a file is: named by form email ("ana@example.com.jpg") or by full name as in the form ("Ana Rivera.jpg"). */
export function photoOwner(fileName: string, names: Map<string, string>): string | null {
  return emailFromName(fileName) ?? names.get(nameKey(fileName.trim().replace(IMAGE_EXT, ''))) ?? null
}

/** Which Drive file to show for each email: professional, then named by email or name, then the row's link. */
export function choosePhotos(pro: DriveFile[], named: DriveFile[], links: Map<string, string>, names = new Map<string, string>()): Map<string, string> {
  const out = new Map<string, string>(links)
  for (const f of [...named, ...pro]) {
    const email = photoOwner(f.name, names)
    if (email && f.mimeType.startsWith('image/')) out.set(email, f.id)
  }
  return out
}

async function drive(token: string, path: string): Promise<Response> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Drive ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res
}

async function listFolder(token: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = []
  let pageToken = ''
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const res = await drive(token, `files?q=${q}&fields=nextPageToken,files(id,name,md5Checksum,mimeType)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${pageToken}` : ''}`)
    const page = (await res.json()) as { files: DriveFile[]; nextPageToken?: string }
    files.push(...page.files)
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return files
}

async function download(token: string, fileId: string): Promise<ArrayBuffer> {
  const meta = (await (await drive(token, `files/${fileId}?fields=thumbnailLink&supportsAllDrives=true`)).json()) as { thumbnailLink?: string }
  if (meta.thumbnailLink) {
    const res = await fetch(meta.thumbnailLink.replace(/=s\d+$/, `=s${PHOTO_SIZE}`), {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (res.ok && res.headers.get('content-type')?.startsWith('image/')) return res.arrayBuffer()
    throw new Error(`Drive thumbnail ${res.status} (${res.headers.get('content-type')}) for file ${fileId}`)
  }
  // No thumbnail yet (Drive makes them shortly after upload): try again on the next run.
  throw new Error(`No thumbnail yet for Drive file ${fileId}`)
}

/** What the folder holds, for /api/status. Counts only, since file names are emails. */
export interface PhotoCounts {
  /** Image files in the folder (and the Professional subfolder). */
  images: number
  /** Of those, named by an instructor's form email or full name. */
  named: number
  /** Subfolders and shortcuts, which photos inside aren't read from (except Professional). */
  folders: number
  shortcuts: number
  /** Instructors on the site with a photo found for them. */
  matched: number
  /** Photos stored and ready to show. */
  ready: number
}

interface PhotoMeta {
  fileId: string
  md5: string
  path: string
}

/**
 * Brings KV's photos in line with Drive and returns each email's photo path on this Worker.
 * A photo is only downloaded again when its file or contents change.
 */
export async function syncPhotos(
  kv: KVNamespace,
  sa: ServiceAccount,
  folderId: string,
  links: Map<string, string>,
  emails: string[],
  names: Map<string, string>,
): Promise<{ photos: Map<string, string>; errors: string[]; counts: PhotoCounts }> {
  const token = await accessToken(sa)
  const top = await listFolder(token, folderId)
  const proFolder = top.find((f) => f.mimeType === 'application/vnd.google-apps.folder' && f.name.trim().toLowerCase() === PRO_FOLDER)
  const pro = proFolder ? await listFolder(token, proFolder.id) : []
  const chosen = choosePhotos(pro, top, links, names)
  const md5s = new Map([...top, ...pro].map((f) => [f.id, f.md5Checksum ?? '']))

  const photos = new Map<string, string>()
  const errors: string[] = []
  let downloads = 0
  for (const email of emails) {
    const fileId = chosen.get(email)
    if (!fileId) continue
    const md5 = md5s.get(fileId) ?? fileId
    const metaKey = `photo-meta:${email}`
    const meta = await kv.get<PhotoMeta>(metaKey, 'json')
    if (meta && meta.fileId === fileId && meta.md5 === md5) {
      photos.set(email, meta.path)
      continue
    }
    if (downloads++ >= DOWNLOADS_PER_RUN) {
      if (meta) photos.set(email, meta.path)
      continue
    }
    try {
      const image = await download(token, fileId)
      const name = `${await instructorId(email)}-${(md5 || fileId).slice(0, 8)}.jpg`
      await kv.put(`photo:${name}`, image)
      if (meta) await kv.delete(`photo:${meta.path.split('/').pop()}`)
      await kv.put(metaKey, JSON.stringify({ fileId, md5, path: `/photos/${name}` } satisfies PhotoMeta))
      photos.set(email, `/photos/${name}`)
    } catch (e) {
      // Keep showing the old photo until the new one comes through.
      if (meta) photos.set(email, meta.path)
      errors.push(String(e))
    }
  }
  const images = [...top, ...pro].filter((f) => f.mimeType.startsWith('image/'))
  const counts: PhotoCounts = {
    images: images.length,
    named: images.filter((f) => photoOwner(f.name, names)).length,
    folders: top.filter((f) => f.mimeType === 'application/vnd.google-apps.folder').length,
    shortcuts: top.filter((f) => f.mimeType === 'application/vnd.google-apps.shortcut').length,
    matched: emails.filter((e) => chosen.has(e)).length,
    ready: photos.size,
  }
  return { photos, errors, counts }
}
