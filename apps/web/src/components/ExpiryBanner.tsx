import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useCan } from '@/lib/auth'

interface LicenseLite {
  state: 'licensed' | 'trial' | 'expired' | 'none'
  daysLeft: number | null
  expires: string | null
}

// Warns admins when the license is close to expiry (§T13). Only shown to settings.manage users.
export function ExpiryBanner() {
  const { t } = useTranslation()
  const can = useCan()
  const show = can('settings.manage')
  const { data } = useQuery({
    queryKey: ['license'],
    queryFn: () => api.get<LicenseLite>('/license'),
    enabled: show,
    staleTime: 60 * 60_000,
  })
  if (!show || !data) return null
  const near =
    (data.state === 'licensed' || data.state === 'trial') &&
    data.daysLeft !== null &&
    data.daysLeft <= 30
  if (!near) return null
  return (
    <div className="bg-warning-muted px-4 py-2 text-center text-sm text-warning-foreground print:hidden">
      {t('license.expiringSoon', { count: data.daysLeft ?? 0 })}
    </div>
  )
}
