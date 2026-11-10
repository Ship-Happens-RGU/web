/**
 * Downloads stored scans from the API and hands them to the point-cloud viewer
 * (`window.__app.openFile`, exposed by packages/viewer/src/main.ts).
 */
import type { Scan } from '@/types/models'

interface ViewerApp {
  openFile: (file: File, handle?: unknown, add?: boolean) => Promise<void>
  confirmReplace: () => Promise<boolean>
  closeScan: () => Promise<void>
}

/** Recently opened scans stay in memory so scrubbing back and forth on the timeline is instant. */
const CACHE_BUDGET_BYTES = 1.5 * 1024 ** 3
const cache = new Map<string, File>()

function remember(id: string, file: File) {
  cache.delete(id)
  cache.set(id, file)

  let total = 0

  for (const f of cache.values()) {
    total += f.size
  }

  for (const [key, f] of cache) {
    if (total <= CACHE_BUDGET_BYTES || cache.size <= 1) {
      break
    }

    cache.delete(key)
    total -= f.size
  }
}

/** Waits for the viewer module (lazy-loaded by ViewerView) to publish its API. */
export async function getViewerApp(timeoutMs = 15000): Promise<ViewerApp> {
  const started = performance.now()

  for (;;) {
    const app = (window as unknown as { __app?: ViewerApp }).__app

    if (app) {
      return app
    }

    if (performance.now() - started > timeoutMs) {
      throw new Error('The viewer did not finish loading')
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/** Fetches a scan's file, reporting progress as a 0..1 fraction. */
export async function downloadScan(
  scan: Scan,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<File> {
  const cached = cache.get(scan.id)

  if (cached) {
    remember(scan.id, cached)
    options.onProgress?.(1)

    return cached
  }

  const response = await fetch(`/api/v1/scans/${scan.id}/file`, {
    credentials: 'include',
    signal: options.signal,
  })

  if (!response.ok || !response.body) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `Download failed (${response.status})`)
  }

  const total = Number(response.headers.get('Content-Length')) || scan.fileSize
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    chunks.push(value)
    received += value.byteLength
    options.onProgress?.(total ? Math.min(received / total, 1) : 0)
  }

  const file = new File(chunks, scan.fileName, { type: 'application/octet-stream' })
  remember(scan.id, file)

  return file
}

/** Downloads a scan and opens it in the viewer, replacing what is shown. */
export async function openScanInViewer(
  scan: Scan,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  const [app, file] = await Promise.all([getViewerApp(), downloadScan(scan, options)])

  if (options.signal?.aborted) {
    return
  }

  await app.openFile(file)
}

