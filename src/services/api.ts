/** Low-level helpers for calling the ShipHappens API (session cookie + CSRF handling). */

export function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=')
}

/** Spring sets the XSRF-TOKEN cookie on the first response; fetch it, priming if needed. */
export async function ensureCsrfToken(): Promise<string | undefined> {
  let token = readCookie('XSRF-TOKEN')

  if (!token) {
    try {
      await fetch('/api/v1/me', { credentials: 'include' })
      token = readCookie('XSRF-TOKEN')
    } catch {
      // ignore network prime failure
    }
  }

  return token
}

/** POSTs JSON to the API with credentials and the CSRF header. Throws on non-2xx. */
export function postJson<T = void>(path: string, body?: unknown): Promise<T> {
  return sendJson<T>('POST', path, body)
}

/** Sends a state-changing request; error responses' { error } message is thrown. */
async function sendJson<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const csrfToken = await ensureCsrfToken()
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `Request failed (${response.status})`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

/** GETs JSON from the API with credentials. Throws on non-2xx. */
export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' })

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }

  return (await response.json()) as T
}
