import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { deleteJson, postForm } from '@/services/api'
import type { Scan } from '@/types/models'

export interface UploadScanInput {
  treeId: string
  file: File
  /** When the scan was taken (not when it was uploaded). */
  scanDate: Date
  name?: string
  notes?: string
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/** Uploads a scan into a tree: the file lands in S3 and a row is committed to the Iceberg scans table. */
export function useUploadScan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ treeId, file, scanDate, name, notes, onProgress, signal }: UploadScanInput) => {
      const form = new FormData()
      form.append('file', file)
      form.append('scanDate', scanDate.toISOString())

      if (name) {
        form.append('name', name)
      }

      if (notes) {
        form.append('notes', notes)
      }

      return postForm<Scan>(`/api/v1/scan-trees/${treeId}/scans`, form, { onProgress, signal })
    },
    onSuccess: (scan) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.treeScans(scan.treeId) })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scanTrees })
    },
  })
}

export function useDeleteScan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scan: Scan) => deleteJson(`/api/v1/scans/${scan.id}`),
    onSuccess: (_, scan) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.treeScans(scan.treeId) })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scanTrees })
    },
  })
}

