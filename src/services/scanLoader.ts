/**
 * Downloads stored scans from the API and hands them to the point-cloud viewer
 * (`window.__app.openFile`, exposed by packages/viewer/src/main.ts).
 */
import type { Scan } from '@/types/models'

interface ViewerApp {
  openFile: (
    file: File,
    handle?: unknown,
    add?: boolean,
    compare?: boolean,
    compareOpacity?: number,
  ) => Promise<void>
  confirmReplace: () => Promise<boolean>
  closeScan: () => Promise<void>
  removeLayer?: (layer: unknown, ask?: boolean) => Promise<void>
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

    await new Promise((resolve) => setTimeout(resolve, 16))
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

/** Streams a scan directly into the viewer via HTTP Range requests (or downloads small/mesh files). */
export async function openScanInViewer(
  scan: Scan,
  options: {
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
    add?: boolean
    compare?: boolean
    compareOpacity?: number
  } = {},
): Promise<void> {
  const cached = cache.get(scan.id)

  if (cached) {
    const app = await getViewerApp()

    if (options.signal?.aborted) {
      return
    }

    remember(scan.id, cached)
    options.onProgress?.(1)
    await app.openFile(cached, undefined, options.add, options.compare, options.compareOpacity)

    return
  }

  const ext = scan.fileName.toLowerCase().split('.').pop() ?? ''
  const isStreamableCloud = ['e57', 'las', 'laz', 'ply', 'ptx'].includes(ext) && scan.fileSize > 4 * 1024 * 1024

  if (isStreamableCloud) {
    const remoteUrl = `/api/v1/scans/${scan.id}/file`
    const headEnd = Math.min(262143, Math.max(0, scan.fileSize - 1))
    const [app, headResp] = await Promise.all([
      getViewerApp(),
      fetch(remoteUrl, {
        credentials: 'include',
        headers: { Range: `bytes=0-${headEnd}` },
        signal: options.signal,
      }),
    ])

    if (options.signal?.aborted) {
      return
    }

    if (headResp.status === 206) {
      const headBuf = await headResp.arrayBuffer()

      if (options.signal?.aborted) {
        return
      }

      const headFile = new File([headBuf], scan.fileName, {
        type: 'application/octet-stream',
        lastModified: Date.parse(scan.uploadedAt) || 0,
      })

      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          reject(new DOMException('Aborted', 'AbortError'))
        }

        options.signal?.addEventListener('abort', onAbort, { once: true })

        void app
          .openFile(
            headFile,
            {
              remoteUrl,
              remoteSize: scan.fileSize,
              scanId: scan.id,
              onProgress: (fraction: number) => {
                options.onProgress?.(fraction)

                if (fraction >= 1) {
                  options.signal?.removeEventListener('abort', onAbort)
                  resolve()
                }
              },
            },
            options.add,
            options.compare,
            options.compareOpacity,
          )
          .catch((err) => {
            options.signal?.removeEventListener('abort', onAbort)
            reject(err)
          })
      })

      return
    }
  }

  const [app, file] = await Promise.all([getViewerApp(), downloadScan(scan, options)])

  if (options.signal?.aborted) {
    return
  }

  await app.openFile(file, undefined, options.add, options.compare, options.compareOpacity)
}

