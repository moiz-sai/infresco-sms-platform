import { Navigate, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMe } from '@/lib/auth'

export function RequireAuth() {
  const { t } = useTranslation()
  const { data: me, isPending } = useMe()
  const location = useLocation()
  if (isPending) {
    return <p className="p-8 text-muted-foreground">{t('app.loading')}</p>
  }
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequirePermission({ perm }: { perm: string }) {
  const { t } = useTranslation()
  const { data: me } = useMe()
  if (!me?.permissions.includes(perm)) {
    return <p className="text-muted-foreground">{t('app.notFound')}</p>
  }
  return <Outlet />
}
