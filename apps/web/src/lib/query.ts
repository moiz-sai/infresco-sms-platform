import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from './api'

// A 401 that means the session ended clears `me`, so RequireAuth redirects to /login.
// Other 401s (wrong password, wrong PIN, disabled account) are shown like any error.
const SESSION_GONE = ['UNAUTHENTICATED', 'SESSION_ENDED']
function onAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && SESSION_GONE.includes(error.code)) {
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
