import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { deleteJson, patchJson, postJson } from '@/services/api'
import type { ScanTree } from '@/types/models'

export function useCreateScanTree() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      postJson<ScanTree>('/api/v1/scan-trees', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scanTrees }),
  })
}

export function useUpdateScanTree() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string }) =>
      patchJson<ScanTree>(`/api/v1/scan-trees/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scanTrees }),
  })
}

export function useDeleteScanTree() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteJson(`/api/v1/scan-trees/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scanTrees }),
  })
}

