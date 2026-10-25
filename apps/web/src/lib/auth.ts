import type { Me } from '@sms/shared'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from './api'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<Me>('/auth/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity,
  })
}

export function useCan() {
  const { data: me } = useMe()
  return (permission: string) => !!me?.permissions.includes(permission)
}

// Landing page after login: the dashboard for those who may see it, the student list otherwise.
export const homePath = (me: Me) =>
  me.permissions.includes('dashboard.view') ? '/dashboard' : '/students'
