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

/** PATCHes JSON to the API with credentials and the CSRF header. Throws on non-2xx. */
export function patchJson<T = void>(path: string, body?: unknown): Promise<T> {
  return sendJson<T>('PATCH', path, body)
}

/** DELETEs an API resource with credentials and the CSRF header. Throws on non-2xx. */
export function deleteJson<T = void>(path: string): Promise<T> {
  return sendJson<T>('DELETE', path)
}

export interface ServerUploadProgress {
  phase: 'processing' | 's3_upload' | 'iceberg_commit' | 'complete' | 'error'
  message: string
  progress: number
  written?: number
  total?: number
  scan?: unknown
}

/**
 * POSTs multipart form data with upload progress and server-side processing stream.
 * Error responses' { error } message is thrown.
 */
export async function postForm<T>(
  path: string,
  form: FormData,
  options: {
    onProgress?: (fraction: number) => void
    onServerProgress?: (progress: ServerUploadProgress) => void
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const csrfToken = await ensureCsrfToken()

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', path)
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/x-ndjson, application/json')

    if (csrfToken) {
      xhr.setRequestHeader('X-XSRF-TOKEN', csrfToken)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(event.loaded / event.total)
      }
    }

    let processedChars = 0
    let completedScan: T | null = null

    const parseStream = () => {
      const text = xhr.responseText || ''
      if (text.length <= processedChars) return

      const newContent = text.substring(processedChars)
      const lines = newContent.split('\n')

      if (!text.endsWith('\n')) {
        lines.pop()
      }

      for (const line of lines) {
        const trimmed = line.trim()
        processedChars += line.length + 1
        if (!trimmed) continue

        try {
          const parsed = JSON.parse(trimmed) as ServerUploadProgress
          options.onServerProgress?.(parsed)

          if (parsed.phase === 'complete' && parsed.scan) {
            completedScan = parsed.scan as T
          } else if (parsed.phase === 'error') {
            throw new Error(parsed.message || 'Upload failed on server')
          }
        } catch (err: unknown) {
          if ((err as Error)?.message !== 'Unexpected end of JSON input') {
            throw err
          }
        }
      }
    }

    xhr.onprogress = () => {
      try {
        parseStream()
      } catch (err) {
        reject(err)
      }
    }

    xhr.onload = () => {
      try {
        parseStream()
      } catch (err) {
        reject(err)
      }

      if (completedScan) {
        resolve(completedScan)
        return
      }

      let body: unknown = null

      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        // non-JSON body
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T)
      } else {
        reject(new Error((body as { error?: string } | null)?.error ?? `Request failed (${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    options.signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(form)
  })
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
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `Request failed (${response.status})`)
  }

  return (await response.json()) as T
}
