import type { Branding } from '@sms/shared'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

// School name, logo and footer come from the developer profile; public, so the login page
// and every print can read them even before sign-in.
export function useBranding() {
  return useQuery({
    queryKey: ['branding'],
    queryFn: () => api.get<Branding>('/branding'),
    staleTime: 5 * 60_000,
  })
}

export function logoUrl(b: Branding | undefined): string | null {
  if (!b?.hasLogo) return null
  return `/api/branding/logo${b.logoVersion ? `?v=${b.logoVersion}` : ''}`
}
