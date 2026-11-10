import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { getJson } from '@/services/api'
import type { Scan } from '@/types/models'

/** Scans of a tree, oldest scan date first (the order of the timeline). */
export function useTreeScans(treeId: string | null) {
  return useQuery<Scan[]>({
    queryKey: QUERY_KEYS.treeScans(treeId ?? ''),
    queryFn: () => getJson<Scan[]>(`/api/v1/scan-trees/${treeId}/scans`),
    enabled: !!treeId,
  })
}

