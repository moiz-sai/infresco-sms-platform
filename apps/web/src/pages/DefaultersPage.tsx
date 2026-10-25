import { formatPaisa, type Defaulter, type Page, type School } from '@sms/shared'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { today } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'
import { useClasses } from '@/lib/setup-queries'

const MONTH_OPTIONS = [1, 2, 3, 6]

export function DefaultersPage() {
  const { t } = useTranslation()
  const name = useLocalName()
  const [params, setParams] = useSearchParams()
  const classId = params.get('classId') ?? ''
  const minMonths = Number(params.get('minMonths') ?? 1)
  const classes = useClasses()
  const school = useQuery({ queryKey: ['school'], queryFn: () => api.get<School>('/school') })
  const list = useQuery({
    queryKey: ['defaulters', classId, minMonths],
    queryFn: () => api.get<Page<Defaulter>>('/fees/defaulters', { classId, minMonths, size: 100 }),
  })
  const setParam = (k: string, v: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (v) next.set(k, v)
      else next.delete(k)
      return next
    })
  const items = list.data?.items ?? []
  const total = items.reduce((s, d) => s + d.balancePaisa, 0)
  const cls = classes.data?.find((c) => c.id === classId)

  return (
    <div className="grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <h1 className="me-auto w-full text-xl font-semibold sm:w-auto">{t('defaulters.title')}</h1>
        <Field label={t('defaulters.class')} className="min-w-40">
          <NativeSelect value={classId} onChange={(e) => setParam('classId', e.target.value)}>
            <NativeSelectOption value="">{t('defaulters.allClasses')}</NativeSelectOption>
            {classes.data?.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {name(c.nameEn, c.nameUr)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('defaulters.minMonths')}>
          <NativeSelect
            value={String(minMonths)}
            onChange={(e) => setParam('minMonths', e.target.value)}
          >
            {MONTH_OPTIONS.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {t('defaulters.months', { count: m })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button variant="outline" onClick={() => window.print()} disabled={!items.length}>
          <Printer />
          {t('attendance.print')}
        </Button>
      </div>

      <div className="hidden items-baseline justify-between print:flex">
        <strong>{school.data && name(school.data.nameEn, school.data.nameUr)}</strong>
        <span>
          {t('defaulters.title')} ·{' '}
          {cls ? name(cls.nameEn, cls.nameUr) : t('defaulters.allClasses')} ·{' '}
          {t('defaulters.months', { count: minMonths })} · {today()}
        </span>
      </div>

      {list.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t('defaulters.empty')}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fees.print.admissionNo')}</TableHead>
              <TableHead>{t('fees.print.student')}</TableHead>
              <TableHead>{t('fees.print.father')}</TableHead>
              <TableHead>{t('fees.print.class')}</TableHead>
              <TableHead className="text-end">{t('defaulters.monthsCol')}</TableHead>
              <TableHead>{t('defaulters.since')}</TableHead>
              <TableHead className="text-end">{t('fees.balance')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((d) => (
              <TableRow key={d.enrollmentId}>
                <TableCell className="tabular-nums">{d.admissionNo}</TableCell>
                <TableCell>
                  <Link
                    to={`/fees/collect?enrollmentId=${d.enrollmentId}`}
                    className="hover:underline print:no-underline"
                  >
                    {name(d.nameEn, d.nameUr)}
                  </Link>
                </TableCell>
                <TableCell>{d.fatherName ?? t('app.none')}</TableCell>
                <TableCell>
                  {name(d.classNameEn, d.classNameUr)} — {d.sectionName}
                </TableCell>
                <TableCell className="text-end tabular-nums">{d.months}</TableCell>
                <TableCell className="tabular-nums">{d.oldestPeriod}</TableCell>
                <TableCell className="text-end font-medium tabular-nums">
                  {formatPaisa(d.balancePaisa)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={6}>
                {t('defaulters.count', { count: list.data?.total ?? 0 })}
              </TableCell>
              <TableCell className="text-end font-semibold tabular-nums">
                {formatPaisa(total)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
      {(list.data?.total ?? 0) > items.length && (
        <p className="text-sm text-muted-foreground print:hidden">
          {t('defaulters.truncated', { shown: items.length, total: list.data?.total })}
        </p>
      )}
    </div>
  )
}
