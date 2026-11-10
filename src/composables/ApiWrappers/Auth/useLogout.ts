import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { postJson } from '@/services/api'

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => postJson('/api/v1/logout'),
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEYS.me, null)
    },
  })
}
