import type { MonthRegister } from '@sms/shared'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Field } from '@/components/Field'
import { Loading } from '@/components/Loading'
import { SectionSelect } from '@/components/SectionSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { today } from '@/lib/form'
import { BrandMark } from '@/components/Brand'
import { useLocalName } from '@/lib/i18n-helpers'
import { useSections } from '@/lib/setup-queries'
import { cn } from '@/lib/utils'

const LETTER_STYLE: Record<string, string> = {
  A: 'text-danger font-semibold',
  L: 'text-warning',
  V: 'text-info',
}

export function AttendanceRegisterPage() {
  const { t } = useTranslation()
  const name = useLocalName()
  const [params, setParams] = useSearchParams()
  const sections = useSections()
  const sectionId = params.get('sectionId') || sections.data?.[0]?.id || ''
  const month = params.get('month') || today().slice(0, 7)
  const section = sections.data?.find((s) => s.id === sectionId)
  const register = useQuery({
    queryKey: ['attendance-register', sectionId, month],
    queryFn: () => api.get<MonthRegister>(`/attendance/sections/${sectionId}/months/${month}`),
    enabled: !!sectionId,
  })
  const setParam = (patch: Record<string, string>) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      for (const [k, v] of Object.entries(patch)) next.set(k, v)
      return next
    })
  const data = register.data
  const marked = new Set(data?.markedDays)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <h1 className="me-auto w-full text-xl font-semibold sm:w-auto">
          {t('attendance.register')}
        </h1>
        <Field label={t('attendance.section')} className="min-w-56">
          <SectionSelect value={sectionId} onChange={(id) => setParam({ sectionId: id })} />
        </Field>
        <Field label={t('attendance.month')}>
          <Input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setParam({ month: e.target.value })}
          />
        </Field>
        <Button variant="outline" onClick={() => window.print()} disabled={!data}>
          <Printer />
          {t('attendance.print')}
        </Button>
      </div>

      {register.isPending && !!sectionId && <Loading rows={8} />}
      {data && (
        <div className="register-print overflow-x-auto">
          <div className="mb-2 hidden items-baseline justify-between print:flex">
            <BrandMark logoClassName="h-6" />
            <span>
              {t('attendance.register')} ·{' '}
              {section && `${name(section.classNameEn, section.classNameUr)} — ${section.name}`} ·{' '}
              {month}
            </span>
          </div>
          <table className="register-table w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr>
                <th className="w-8 border px-1 py-1 text-start">{t('attendance.roll')}</th>
                <th className="border px-2 py-1 text-start">{t('attendance.name')}</th>
                {data.days.map((d) => (
                  <th
                    key={d}
                    className={cn(
                      'w-6 border px-0.5 py-1 text-center',
                      !marked.has(d) && 'text-muted-foreground',
                    )}
                  >
                    {Number(d.slice(8))}
                  </th>
                ))}
                {(['P', 'A', 'L', 'V'] as const).map((s) => (
                  <th key={s} className="border bg-muted px-1 py-1 text-center">
                    {t(`attendance.short.${s}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.enrollmentId}>
                  <td className="border px-1 py-0.5">{r.rollNo ?? ''}</td>
                  <td className="border px-2 py-0.5 whitespace-nowrap">
                    {name(r.nameEn, r.nameUr)}
                  </td>
                  {data.days.map((d) => {
                    const s = r.statuses[d]
                    return (
                      <td
                        key={d}
                        className={cn('border px-0.5 py-0.5 text-center', s && LETTER_STYLE[s])}
                      >
                        {s ? t(`attendance.short.${s}`) : ''}
                      </td>
                    )
                  })}
                  {(['P', 'A', 'L', 'V'] as const).map((s) => (
                    <td key={s} className="border bg-muted/50 px-1 py-0.5 text-center font-medium">
                      {r.totals[s]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">{t('attendance.empty')}</p>
          )}
        </div>
      )}
    </div>
  )
}
