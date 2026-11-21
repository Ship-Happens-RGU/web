/**
 * E57 → GLB model conversion (in a Web Worker) and upload of the result to the API, where it is
 * stored beside the scan so the viewer can load the model first.
 */
import { postForm } from '@/services/api'
import type { ScanModelInfo } from '@/types/models'
import type { ConvertMessage, ConvertStats } from '@/workers/e57ToGlb.worker'

export type { ConvertStats }

export interface ModelProgress {
  /** 0..1 across conversion and upload. */
  fraction: number
  message: string
}

/** Only E57 can be converted; other formats keep the point-cloud view. */
export function canConvertToModel(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.e57')
}

/** Runs the conversion worker. Aborting terminates the worker immediately. */
export function convertE57ToGlb(
  file: File,
  options: { onProgress?: (p: ModelProgress) => void; signal?: AbortSignal } = {},
): Promise<{ glb: Blob; stats: ConvertStats }> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))

      return
    }

    const worker = new Worker(new URL('../workers/e57ToGlb.worker.ts', import.meta.url), { type: 'module' })
    const onAbort = () => {
      worker.terminate()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const finish = () => {
      options.signal?.removeEventListener('abort', onAbort)
      worker.terminate()
    }

    options.signal?.addEventListener('abort', onAbort, { once: true })

    worker.onmessage = (ev: MessageEvent<ConvertMessage>) => {
      const m = ev.data

      if (m.type === 'progress') {
        options.onProgress?.({ fraction: m.fraction, message: m.message })
      } else if (m.type === 'done') {
        finish()
        resolve({ glb: new Blob([m.glb], { type: 'model/gltf-binary' }), stats: m.stats })
      } else {
        finish()
        reject(new Error(m.message))
      }
    }

    worker.onerror = (ev) => {
      finish()
      reject(new Error(ev.message || 'The model converter crashed'))
    }

    worker.postMessage({ type: 'convert', file })
  })
}

/** Uploads a converted model for a scan, replacing any earlier one. */
export function uploadScanModel(
  scanId: string,
  glb: Blob,
  stats: ConvertStats,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<ScanModelInfo> {
  const form = new FormData()
  form.append('file', glb, 'model.glb')
  form.append('vertexCount', String(stats.vertices))
  form.append('triangleCount', String(stats.triangles))
  form.append('voxelCm', String(stats.voxelCm))

  return postForm<ScanModelInfo>(`/api/v1/scans/${scanId}/model`, form, options)
}

/**
 * Converts a scan file and uploads the model. Progress runs 0 → 0.9 for conversion and
 * 0.9 → 1 for the upload.
 */
export async function generateScanModel(
  scanId: string,
  file: File,
  options: { onProgress?: (p: ModelProgress) => void; signal?: AbortSignal } = {},
): Promise<ScanModelInfo> {
  const { glb, stats } = await convertE57ToGlb(file, {
    signal: options.signal,
    onProgress: (p) => options.onProgress?.({ fraction: p.fraction * 0.9, message: p.message }),
  })

  options.onProgress?.({ fraction: 0.9, message: 'Uploading model…' })

  return uploadScanModel(scanId, glb, stats, {
    signal: options.signal,
    onProgress: (f) => options.onProgress?.({ fraction: 0.9 + f * 0.1, message: 'Uploading model…' }),
  })
}
