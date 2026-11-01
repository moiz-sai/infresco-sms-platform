import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useCan } from '@/lib/auth'

interface Health {
  lastGoodAt: string | null
  stale: boolean
  pgReady: boolean
}

// Warns admins when no backup has succeeded in 48 h (§T14). Only shown to settings.manage users.
export function BackupBanner() {
  const { t } = useTranslation()
  const can = useCan()
  const show = can('settings.manage')
  const { data } = useQuery({
    queryKey: ['backup-health'],
    queryFn: () => api.get<Health>('/backup-health'),
    enabled: show,
    staleTime: 30 * 60_000,
  })
  if (!show || !data?.pgReady || !data.stale) return null
  return (
    <div className="bg-warning-muted px-4 py-2 text-center text-sm text-warning-foreground print:hidden">
      {t('backupBanner')}
    </div>
  )
}
