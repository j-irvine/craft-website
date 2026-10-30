// Reads the instructor sheet with the website's Google service account (read-only scopes).
// The same signing approach as Craft Apps' worker/push.ts.

export interface ServiceAccount {
  client_email: string
  private_key: string
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly'

function base64url(data: string | ArrayBuffer): string {
  const s = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const raw = atob(body)
  const der = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) der[i] = raw.charCodeAt(i)
  return der.buffer
}

export function parseServiceAccount(json: string | undefined): ServiceAccount | null {
  try {
    const sa = JSON.parse(json ?? '') as Partial<ServiceAccount>
    return sa.client_email && sa.private_key ? (sa as ServiceAccount) : null
  } catch {
    return null
  }
}

let cachedToken: { email: string; token: string; expiresAt: number } | null = null

export async function accessToken(sa: ServiceAccount, now = Date.now()): Promise<string> {
  if (cachedToken && cachedToken.email === sa.client_email && cachedToken.expiresAt - 5 * 60_000 > now) return cachedToken.token
  const iat = Math.floor(now / 1000)
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }),
  )}`
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64url(signature)}` }),
  })
  if (!res.ok) throw new Error(`Google sign-in ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { email: sa.client_email, token: access_token, expiresAt: now + expires_in * 1000 }
  return access_token
}

/** Every row of one tab, header first. Checkboxes come back as TRUE/FALSE. */
export async function readSheet(sa: ServiceAccount, sheetId: string, tab: string): Promise<string[][]> {
  const token = await accessToken(sa)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`'${tab}'`)}`
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const { values } = (await res.json()) as { values?: string[][] }
  return values ?? []
}
