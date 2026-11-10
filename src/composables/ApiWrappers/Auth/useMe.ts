import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { getJson } from '@/services/api'
import type { AuthenticatedUser } from '@/types/models'

export function useMe() {
  return useQuery<AuthenticatedUser | null>({
    queryKey: QUERY_KEYS.me,
    queryFn: async () => {
      try {
        return await getJson<AuthenticatedUser>('/api/v1/me')
      } catch {
        return null
      }
    },
    retry: false,
  })
}
