import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { getJson } from '@/services/api'
import type { ScanTree } from '@/types/models'

export function useScanTree(treeId: string | null) {
  return useQuery<ScanTree>({
    queryKey: QUERY_KEYS.scanTree(treeId ?? ''),
    queryFn: () => getJson<ScanTree>(`/api/v1/scan-trees/${treeId}`),
    enabled: !!treeId,
  })
}

