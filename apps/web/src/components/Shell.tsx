import type { ApprovalItem, Page, School } from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Banknote,
  BadgeCheck,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  Coins,
  FileWarning,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldUser,
  SlidersHorizontal,
  UserPlus,
  Users,
  UserRoundCog,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { LanguageToggle } from '@/components/LanguageToggle'
import { SwitchUserDialog } from '@/components/SwitchUserDialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { useLocalName } from '@/lib/i18n-helpers'
import { cn } from '@/lib/utils'

const NAV = [
  {
    to: '/dashboard',
    key: 'nav.dashboard',
    perm: 'dashboard.view',
    icon: LayoutDashboard,
    end: true,
  },
  { to: '/students', key: 'nav.students', perm: 'students.view', icon: Users, end: true },
  { to: '/students/new', key: 'nav.admission', perm: 'students.edit', icon: UserPlus, end: true },
  {
    to: '/students/promote',
    key: 'nav.promote',
    perm: 'students.promote',
    icon: ArrowRightLeft,
    end: true,
  },
  {
    to: '/attendance',
    key: 'nav.attendance',
    perm: 'attendance.mark',
    icon: ClipboardCheck,
    end: true,
  },
  {
    to: '/attendance/register',
    key: 'nav.register',
    perm: 'attendance.view',
    icon: CalendarDays,
    end: true,
  },
  { to: '/fees/collect', key: 'nav.feeCollect', perm: 'fees.collect', icon: Banknote, end: true },
  { to: '/fees/setup', key: 'nav.feeSetup', perm: 'fees.configure', icon: Coins, end: true },
  {
    to: '/fees/cash-close',
    key: 'nav.cashClose',
    perm: 'fees.cash_close',
    icon: Calculator,
    end: true,
  },
  {
    to: '/fees/defaulters',
    key: 'nav.defaulters',
    perm: 'fees.defaulters',
    icon: FileWarning,
    end: true,
  },
  { to: '/approvals', key: 'nav.approvals', perm: 'approvals.decide', icon: BadgeCheck, end: true },
  { to: '/setup', key: 'nav.setup', perm: 'setup.manage', icon: Settings, end: false },
  {
    to: '/settings',
    key: 'nav.settings',
    perm: 'settings.manage',
    icon: SlidersHorizontal,
    end: true,
  },
  { to: '/users', key: 'nav.users', perm: 'users.manage', icon: ShieldUser, end: true },
  { to: '/audit', key: 'nav.audit', perm: 'audit.view', icon: History, end: true },
] as const

export function Shell() {
  const { t } = useTranslation()
  const name = useLocalName()
  const { data: me } = useMe()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [switchOpen, setSwitchOpen] = useState(false)
  const school = useQuery({ queryKey: ['school'], queryFn: () => api.get<School>('/school') })
  const canApprove = !!me?.permissions.includes('approvals.decide')
  const pending = useQuery({
    queryKey: ['approvals-count'],
    queryFn: () => api.get<Page<ApprovalItem>>('/approvals', { status: 'pending', size: 1 }),
    enabled: canApprove,
    refetchInterval: 60_000,
  })
  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      qc.clear()
      qc.setQueryData(['me'], null)
      void navigate('/login')
    },
  })

  const links = NAV.filter((n) => me?.permissions.includes(n.perm)).map((n) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-accent',
          isActive && 'bg-accent font-medium',
        )
      }
    >
      <n.icon className="size-4" />
      {t(n.key)}
      {n.to === '/approvals' && !!pending.data?.total && (
        <span className="ms-auto rounded-full bg-danger px-1.5 text-xs font-semibold text-white">
          {pending.data.total}
        </span>
      )}
    </NavLink>
  ))

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-56 print:hidden shrink-0 flex-col gap-1 border-e bg-muted/40 p-3 md:flex">
        <div className="mb-4 px-3 py-2 font-semibold leading-tight">
          {school.data ? name(school.data.nameEn, school.data.nameUr) : t('app.name')}
        </div>
        {links}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b px-4 print:hidden">
          <span className="font-semibold md:hidden">
            {school.data ? name(school.data.nameEn, school.data.nameUr) : t('app.name')}
          </span>
          <div className="flex-1" />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {me && name(me.nameEn, me.nameUr)}
          </span>
          <LanguageToggle />
          <Button variant="outline" size="sm" onClick={() => setSwitchOpen(true)}>
            <UserRoundCog />
            <span className="hidden sm:inline">{t('app.switchUser')}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
            <LogOut />
            <span className="hidden sm:inline">{t('app.logout')}</span>
          </Button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b px-2 py-1 md:hidden print:hidden">
          {links}
        </nav>
        <main className="flex-1 p-4 md:p-6 print:p-0">
          <Outlet />
        </main>
      </div>
      <SwitchUserDialog open={switchOpen} onOpenChange={setSwitchOpen} />
    </div>
  )
}
