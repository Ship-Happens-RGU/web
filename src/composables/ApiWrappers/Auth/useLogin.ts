import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { postJson } from '@/services/api'
import type { AuthenticatedUser } from '@/types/models'

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      postJson<AuthenticatedUser>('/api/v1/login', credentials),
    onSuccess: (user) => {
      queryClient.setQueryData(QUERY_KEYS.me, user)
    },
  })
}
