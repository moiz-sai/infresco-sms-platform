import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api'

// Any 401 means the session ended: clearing `me` makes RequireAuth redirect to /login.
function onAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(['me'], null)
    return true
  }
  return false
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onAuthError }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (!onAuthError(error)) toast.error(error.message)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})
