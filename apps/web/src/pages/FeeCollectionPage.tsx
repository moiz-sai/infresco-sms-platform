import {
  formatPaisa,
  paymentMethods,
  paymentSchema,
  type Page,
  type PaymentMethod,
  type Statement,
  type StudentListItem,
} from '@sms/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Percent, Search, Users } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { DiscountDialog } from '@/components/DiscountDialog'
import { Field } from '@/components/Field'
import { StatementTable } from '@/components/StatementTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { api } from '@/lib/api'
import { useCan } from '@/lib/auth'
import { submitOnCtrlEnter, validate } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'
import { paisaToRupees, rupeesToPaisa } from '@/lib/money'
import { printReceipt, receiptFormat, type ReceiptFormat } from '@/lib/print'
import { cn } from '@/lib/utils'

export function FeeCollectionPage() {
  const { t } = useTranslation()
  const name = useLocalName()
  const [params, setParams] = useSearchParams()
  const enrollmentId = params.get('enrollmentId') ?? ''
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(id)
  }, [search])

  const results = useQuery({
    queryKey: ['students', { q: debounced, collect: true }],
    queryFn: () => api.get<Page<StudentListItem>>('/students', { q: debounced, size: 10 }),
    enabled: debounced.length > 0,
    placeholderData: keepPreviousData,
  })

  const select = (id: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (id) next.set('enrollmentId', id)
      else next.delete('enrollmentId')
      return next
    })

  const backToSearch = () => {
    select('')
    setSearch('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  function onListKey(e: KeyboardEvent<HTMLLIElement>, index: number, id: string) {
    const items = listRef.current?.querySelectorAll<HTMLLIElement>('li[data-item]')
    if (e.key === 'ArrowDown') items?.[index + 1]?.focus()
    else if (e.key === 'ArrowUp') (index === 0 ? searchRef.current : items?.[index - 1])?.focus()
    else if (e.key === 'Enter') select(id)
    else return
    e.preventDefault()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div className="grid content-start gap-3">
        <h1 className="text-xl font-semibold">{t('fees.collect')}</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            className="ps-8"
            placeholder={t('fees.search')}
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault()
                listRef.current?.querySelector<HTMLLIElement>('li[data-item]')?.focus()
              }
            }}
          />
        </div>
        {debounced && results.data && (
          <ul ref={listRef} className="divide-y rounded-lg border">
            {results.data.items.map((s, i) => (
              <li
                key={s.enrollmentId}
                data-item
                tabIndex={0}
                onKeyDown={(e) => onListKey(e, i, s.enrollmentId)}
                onClick={() => select(s.enrollmentId)}
                className={cn(
                  'cursor-pointer px-3 py-2 outline-none hover:bg-accent focus:bg-accent',
                  s.enrollmentId === enrollmentId && 'bg-accent',
                )}
              >
                <div className="font-medium">{name(s.nameEn, s.nameUr)}</div>
                <div className="text-xs text-muted-foreground">
                  {s.admissionNo} · {name(s.classNameEn, s.classNameUr)} — {s.sectionName}
                  {s.fatherName && ` · ${s.fatherName}`}
                </div>
              </li>
            ))}
            {results.data.items.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                {t('students.empty')}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="min-w-0">
        {enrollmentId ? (
          <CollectPanel
            key={enrollmentId}
            enrollmentId={enrollmentId}
            onSelect={select}
            onDone={backToSearch}
          />
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            {t('fees.pickStudent')}
          </p>
        )}
      </div>
    </div>
  )
}

function CollectPanel({
  enrollmentId,
  onSelect,
  onDone,
}: {
  enrollmentId: string
  onSelect: (id: string) => void
  onDone: () => void
}) {
  const statement = useQuery({
    queryKey: ['statement', enrollmentId],
    queryFn: () => api.get<Statement>(`/fees/students/${enrollmentId}/statement`),
  })
  if (!statement.data) return null
  return <CollectForm s={statement.data} onSelect={onSelect} onDone={onDone} />
}

function CollectForm({
  s,
  onSelect,
  onDone,
}: {
  s: Statement
  onSelect: (id: string) => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const name = useLocalName()
  const qc = useQueryClient()
  const [amount, setAmount] = useState(s.balancePaisa > 0 ? paisaToRupees(s.balancePaisa) : '')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [format, setFormat] = useState<ReceiptFormat>(receiptFormat.get())
  const [error, setError] = useState('')
  const can = useCan()
  const [discounting, setDiscounting] = useState(false)

  const pay = useMutation({
    mutationFn: (body: unknown) =>
      api.post<{ receiptId: string; receiptNo: string }>('/fees/payments', body),
    onSuccess: (res) => {
      printReceipt(res.receiptId, format)
      toast.success(t('fees.received', { no: res.receiptNo }))
      void qc.invalidateQueries({ queryKey: ['statement'] })
      onDone()
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const paisa = rupeesToPaisa(amount)
    const result = validate(paymentSchema, {
      enrollmentId: s.student.enrollmentId,
      amountPaisa: paisa ?? Number.NaN,
      method,
    })
    if (!result.ok) return setError(t('errors.invalid'))
    setError('')
    pay.mutate(result.data)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-lg font-semibold">{s.student.nameEn}</h2>
        {s.student.nameUr && (
          <span dir="rtl" lang="ur" className="font-urdu text-lg">
            {s.student.nameUr}
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          {s.student.admissionNo} · {name(s.student.classNameEn, s.student.classNameUr)} —{' '}
          {s.student.sectionName}
          {s.student.fatherName && ` · ${s.student.fatherName}`}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{t('fees.dues')}</CardTitle>
            {can('fees.discount') && s.dues.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setDiscounting(true)}
              >
                <Percent />
                {t('discount.button')}
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {s.dues.length === 0 && <p className="text-muted-foreground">{t('fees.noDues')}</p>}
            {s.dues.map((d) => (
              <div key={`${d.period}:${d.headId}`} className="flex justify-between gap-2">
                <span>
                  {d.period} · {name(d.headNameEn, d.headNameUr)}
                </span>
                <span className="tabular-nums">{formatPaisa(d.amountPaisa)}</span>
              </div>
            ))}
            {s.advancePaisa > 0 && (
              <div className="flex justify-between gap-2 text-emerald-700">
                <span>{t('fees.advance')}</span>
                <span className="tabular-nums">−{formatPaisa(s.advancePaisa)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between gap-2 border-t pt-2 text-base font-semibold">
              <span>{t('fees.total')}</span>
              <span className="tabular-nums">{formatPaisa(Math.max(0, s.balancePaisa))}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <form className="grid gap-3" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
              <Field label={t('fees.pay')} error={error}>
                <Input
                  value={amount}
                  inputMode="decimal"
                  autoFocus
                  className="h-11 text-lg tabular-nums"
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && onDone()}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('fees.method')}>
                  <NativeSelect
                    className="w-full"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  >
                    {paymentMethods.map((m) => (
                      <NativeSelectOption key={m} value={m}>
                        {t(`fees.methods.${m}`)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={t('fees.printFormat')}>
                  <NativeSelect
                    className="w-full"
                    value={format}
                    onChange={(e) => {
                      const f = e.target.value as ReceiptFormat
                      setFormat(f)
                      receiptFormat.set(f)
                    }}
                  >
                    <NativeSelectOption value="80">{t('fees.formats.80')}</NativeSelectOption>
                    <NativeSelectOption value="a4">{t('fees.formats.a4')}</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>
              <Button type="submit" size="lg" disabled={pay.isPending}>
                {t('fees.saveAndPrint')}
              </Button>
              <span className="text-xs text-muted-foreground">{t('fees.saveHint')}</span>
            </form>
          </CardContent>
        </Card>
      </div>

      {s.siblings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              {t('fees.siblings')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {s.siblings.map((sib) => (
              <Button
                key={sib.enrollmentId}
                variant="outline"
                size="sm"
                onClick={() => onSelect(sib.enrollmentId)}
              >
                {name(sib.nameEn, sib.nameUr)} · {name(sib.classNameEn, sib.classNameUr)} —{' '}
                {sib.sectionName}
                <span className={cn('tabular-nums', sib.balancePaisa > 0 && 'text-red-600')}>
                  {formatPaisa(sib.balancePaisa)}
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <DiscountDialog
        enrollmentId={s.student.enrollmentId}
        dues={s.dues}
        open={discounting}
        onOpenChange={setDiscounting}
      />
      {s.entries.length > 0 && (
        <div className="grid gap-2">
          <h3 className="font-medium">{t('fees.recent')}</h3>
          <StatementTable entries={s.entries.slice(-10)} />
        </div>
      )}
    </div>
  )
}
