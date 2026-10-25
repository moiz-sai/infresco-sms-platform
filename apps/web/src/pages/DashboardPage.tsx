import { formatPaisa, type ApprovalItem, type Dashboard, type Page } from '@sms/shared'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { lazy, Suspense, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useCan } from '@/lib/auth'
import { useLocalName } from '@/lib/i18n-helpers'
import { cn } from '@/lib/utils'

const DashboardCharts = lazy(() => import('@/components/DashboardCharts'))

export function DashboardPage() {
  const { t } = useTranslation()
  const name = useLocalName()
  const can = useCan()
  const dash = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dashboard>('/dashboard'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const approvals = useQuery({
    queryKey: ['approvals', 'pending', 'top'],
    queryFn: () => api.get<Page<ApprovalItem>>('/approvals', { status: 'pending', size: 5 }),
    enabled: can('approvals.decide'),
  })

  if (!dash.data) return <Skeleton className="h-96 w-full" />
  const d = dash.data
  const todayTotal = d.todayCollection.reduce((s, c) => s + c.totalPaisa, 0)
  const monthPct =
    d.month.expectedPaisa > 0
      ? Math.round((d.month.collectedPaisa * 100) / d.month.expectedPaisa)
      : null
  const marked = d.attendanceTrend.find((p) => p.date === d.date)

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <h1 className="me-auto text-xl font-semibold">{t('dashboard.title')}</h1>
        <span className="text-sm text-muted-foreground">{d.date}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('dashboard.refresh')}
          onClick={() => void dash.refetch()}
        >
          <RefreshCw className={cn(dash.isFetching && 'animate-spin')} />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.today')} value={formatPaisa(todayTotal)}>
          {d.todayCollection.map((c) => (
            <span key={c.method}>
              {t(`fees.methods.${c.method}`)}: {formatPaisa(c.totalPaisa)} ({c.count})
            </span>
          ))}
        </StatCard>
        <StatCard
          label={t('dashboard.month', { period: d.period })}
          value={formatPaisa(d.month.collectedPaisa)}
        >
          <span>
            {t('dashboard.ofExpected', { amount: formatPaisa(d.month.expectedPaisa) })}
            {monthPct !== null && ` · ${monthPct}%`}
          </span>
        </StatCard>
        <StatCard
          label={t('dashboard.attendanceToday')}
          value={marked ? `${marked.pct}%` : t('app.none')}
        >
          <span>{t('dashboard.absentCount', { count: d.absentCount })}</span>
        </StatCard>
        <StatCard
          label={t('dashboard.defaulters')}
          value={String(d.defaulters.count)}
          to={can('fees.collect') ? '/fees/defaulters' : undefined}
        >
          <span>{formatPaisa(d.defaulters.totalPaisa)}</span>
        </StatCard>
        <StatCard
          label={t('dashboard.pending')}
          value={String(d.pendingApprovals)}
          to={can('approvals.decide') ? '/approvals' : undefined}
          alert={d.pendingApprovals > 0}
        />
        <StatCard
          label={t('dashboard.lastClose')}
          value={d.lastCashClose ? formatPaisa(d.lastCashClose.differencePaisa) : t('app.none')}
          alert={!!d.lastCashClose && d.lastCashClose.differencePaisa !== 0}
        >
          {d.lastCashClose && <span>{d.lastCashClose.date}</span>}
        </StatCard>
        <StatCard
          label={t('dashboard.students')}
          value={String(d.enrollment.total)}
          className="sm:col-span-2"
        >
          <span>
            {t('dashboard.boysGirls', {
              boys: d.enrollment.boys,
              girls: d.enrollment.girls,
            })}
            {d.enrollment.genderUnset > 0 &&
              ` · ${t('dashboard.genderUnset', { count: d.enrollment.genderUnset })}`}
          </span>
          <span>
            {t('dashboard.joinedLeft', {
              joined: d.enrollment.joinedThisMonth,
              left: d.enrollment.leftThisMonth,
            })}
          </span>
        </StatCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-64 w-full lg:col-span-2" />}>
          <DashboardCharts data={d} />
        </Suspense>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="grid content-start gap-2 rounded-lg border p-4">
          <h2 className="text-sm font-medium">{t('dashboard.classSizes')}</h2>
          <table className="text-sm tabular-nums">
            <tbody>
              {d.enrollment.classes.map((c) => (
                <tr key={c.classId} className="border-b last:border-0">
                  <td className="py-1 pe-2">{name(c.classNameEn, c.classNameUr)}</td>
                  <td className="py-1 text-muted-foreground">
                    {c.sections.map((s) => `${s.name} ${s.total}`).join(' · ')}
                  </td>
                  <td className="py-1 text-end font-medium">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid content-start gap-2 rounded-lg border p-4">
          <h2 className="text-sm font-medium">{t('dashboard.absentees')}</h2>
          {d.absentees.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noAbsentees')}</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {d.absentees.map((a) => (
                <li key={a.enrollmentId} className="flex gap-2">
                  <Link to={`/students/${a.studentId}`} className="me-auto hover:underline">
                    {name(a.nameEn, a.nameUr)}
                  </Link>
                  <span className="text-muted-foreground">
                    {name(a.classNameEn, a.classNameUr)} — {a.sectionName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {can('approvals.decide') && (
          <section className="grid content-start gap-2 rounded-lg border p-4">
            <h2 className="text-sm font-medium">{t('dashboard.pending')}</h2>
            {approvals.data?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('approvals.empty')}</p>
            )}
            <ul className="grid gap-1 text-sm">
              {approvals.data?.items.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className="me-auto">{t(`approvals.actions.${a.action}`)}</span>
                  <span className="text-muted-foreground">{a.requestedByName}</span>
                </li>
              ))}
            </ul>
            {!!approvals.data?.total && (
              <Button asChild size="sm" variant="outline" className="justify-self-start">
                <Link to="/approvals">{t('dashboard.openApprovals')}</Link>
              </Button>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  to,
  alert,
  className,
  children,
}: {
  label: string
  value: string
  to?: string
  alert?: boolean
  className?: string
  children?: ReactNode
}) {
  const body = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-2xl font-semibold tabular-nums', alert && 'text-danger')}>
        {value}
      </span>
      <span className="grid text-xs text-muted-foreground">{children}</span>
    </>
  )
  const cls = cn('grid content-start gap-1 rounded-lg border p-4', className)
  return to ? (
    <Link to={to} className={cn(cls, 'hover:bg-accent')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
