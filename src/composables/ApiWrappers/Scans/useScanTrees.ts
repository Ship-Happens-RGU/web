import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { getJson } from '@/services/api'
import type { ScanTree } from '@/types/models'

export function useScanTrees() {
  return useQuery<ScanTree[]>({
    queryKey: QUERY_KEYS.scanTrees,
    queryFn: () => getJson<ScanTree[]>('/api/v1/scan-trees'),
  })
}

