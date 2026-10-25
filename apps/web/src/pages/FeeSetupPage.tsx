import {
  ADVANCE_HEAD,
  feeFrequencies,
  feeHeadSchema,
  type FeeHead,
  type FeeStructure,
  type PostChargesResult,
  type SchoolClass,
  type Year,
} from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { submitOnCtrlEnter, today, validate, type FieldErrors } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'
import { paisaToRupees, rupeesToPaisa } from '@/lib/money'
import { useClasses } from '@/lib/setup-queries'

type Frequency = (typeof feeFrequencies)[number]

export function FeeSetupPage() {
  const { t } = useTranslation()
  const heads = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => api.get<FeeHead[]>('/fee-heads'),
  })
  const structures = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => api.get<FeeStructure[]>('/fee-structures'),
  })
  const years = useQuery({ queryKey: ['years'], queryFn: () => api.get<Year[]>('/years') })
  const classes = useClasses()
  const year = years.data?.find((y) => y.isCurrent)

  return (
    <div className="grid max-w-5xl gap-4">
      <h1 className="text-xl font-semibold">{t('fees.setup')}</h1>
      {heads.data && structures.data && classes.data && year && (
        <FeeGrid
          // Re-initialise the editable cells whenever fresh data arrives.
          key={structures.dataUpdatedAt + heads.dataUpdatedAt}
          heads={heads.data.filter((h) => h.code !== ADVANCE_HEAD)}
          classes={classes.data}
          structures={structures.data}
          year={year}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {heads.data && <Heads heads={heads.data} />}
        <PostCharges />
      </div>
    </div>
  )
}

function FeeGrid({
  heads,
  classes,
  structures,
  year,
}: {
  heads: FeeHead[]
  classes: SchoolClass[]
  structures: FeeStructure[]
  year: Year
}) {
  const { t } = useTranslation()
  const name = useLocalName()
  const qc = useQueryClient()
  const existing = new Map(structures.map((s) => [`${s.classId}:${s.headId}`, s]))
  const [cells, setCells] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      structures.map((s) => [`${s.classId}:${s.headId}`, paisaToRupees(s.amountPaisa)]),
    ),
  )
  const [freq, setFreq] = useState<Record<string, Frequency>>(() =>
    Object.fromEntries(
      heads.map((h) => [h.id, structures.find((s) => s.headId === h.id)?.frequency ?? 'monthly']),
    ),
  )
  const [bad, setBad] = useState<Set<string>>(new Set())

  const save = useMutation({
    mutationFn: async () => {
      const calls: Promise<unknown>[] = []
      for (const c of classes) {
        for (const h of heads) {
          const key = `${c.id}:${h.id}`
          const before = existing.get(key)
          const text = (cells[key] ?? '').trim()
          if (!text) {
            if (before) calls.push(api.del(`/fee-structures/${before.id}`))
            continue
          }
          const amountPaisa = rupeesToPaisa(text)!
          if (before && before.amountPaisa === amountPaisa && before.frequency === freq[h.id])
            continue
          calls.push(
            api.post('/fee-structures', {
              classId: c.id,
              yearId: year.id,
              headId: h.id,
              amountPaisa,
              frequency: freq[h.id],
            }),
          )
        }
      }
      await Promise.all(calls)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fee-structures'] })
      toast.success(t('app.saved'))
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const invalid = new Set(
      Object.entries(cells)
        .filter(([, v]) => v.trim() && rupeesToPaisa(v) === null)
        .map(([k]) => k),
    )
    setBad(invalid)
    if (invalid.size === 0) save.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('fees.grid', { year: year.label })}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('students.class')}</TableHead>
                  {heads.map((h) => (
                    <TableHead key={h.id} className="min-w-32 text-start">
                      <div className="grid gap-1 py-1">
                        <span>{name(h.nameEn, h.nameUr)}</span>
                        <NativeSelect
                          size="sm"
                          className="w-full"
                          aria-label={t('fees.frequency')}
                          value={freq[h.id]}
                          onChange={(e) =>
                            setFreq((f) => ({ ...f, [h.id]: e.target.value as Frequency }))
                          }
                        >
                          {feeFrequencies.map((fq) => (
                            <NativeSelectOption key={fq} value={fq}>
                              {t(`fees.frequencies.${fq}`)}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{name(c.nameEn, c.nameUr)}</TableCell>
                    {heads.map((h) => {
                      const key = `${c.id}:${h.id}`
                      return (
                        <TableCell key={h.id}>
                          <Input
                            value={cells[key] ?? ''}
                            inputMode="decimal"
                            aria-invalid={bad.has(key)}
                            className="h-8 tabular-nums"
                            onChange={(e) => setCells((s) => ({ ...s, [key]: e.target.value }))}
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={save.isPending}>
              {t('app.save')}
            </Button>
            <span className="text-sm text-muted-foreground">{t('fees.gridHint')}</span>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function Heads({ heads }: { heads: FeeHead[] }) {
  const { t } = useTranslation()
  const name = useLocalName()
  const qc = useQueryClient()
  const [errors, setErrors] = useState<FieldErrors>({})
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['fee-heads'] })
    void qc.invalidateQueries({ queryKey: ['fee-structures'] })
  }
  const create = useMutation({
    mutationFn: (body: unknown) => api.post('/fee-heads', body),
    onSuccess: () => {
      refresh()
      toast.success(t('app.saved'))
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/fee-heads/${id}`),
    onSuccess: () => {
      refresh()
      toast.success(t('app.deleted'))
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const result = validate(feeHeadSchema, Object.fromEntries(new FormData(form)))
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    create.mutate(result.data, { onSuccess: () => form.reset() })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('fees.heads')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t('fees.code')}</TableHead>
                <TableHead className="text-start">{t('fees.name')}</TableHead>
                <TableHead className="text-start">{t('fees.priority')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {heads.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-mono">{h.code}</TableCell>
                  <TableCell>{name(h.nameEn, h.nameUr)}</TableCell>
                  <TableCell>{h.priority}</TableCell>
                  <TableCell className="text-end">
                    {h.code !== ADVANCE_HEAD && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('app.delete')}
                        onClick={() => confirm(t('app.confirmDelete')) && remove.mutate(h.id)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <form className="grid grid-cols-2 gap-3" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
          <Field label={t('fees.code')} error={errors.code}>
            <Input name="code" placeholder="TRN" className="uppercase" />
          </Field>
          <Field label={t('fees.priority')} error={errors.priority}>
            <Input name="priority" inputMode="numeric" placeholder="30" />
          </Field>
          <Field label={t('setup.nameEn')} error={errors.nameEn}>
            <Input name="nameEn" placeholder="Transport" />
          </Field>
          <Field label={t('setup.nameUr')} error={errors.nameUr}>
            <Input name="nameUr" dir="rtl" lang="ur" className="font-urdu" />
          </Field>
          <Button
            type="submit"
            className="col-span-2 justify-self-start"
            disabled={create.isPending}
          >
            <Plus />
            {t('app.add')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PostCharges() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [period, setPeriod] = useState(today().slice(0, 7))
  const post = useMutation({
    mutationFn: () => api.post<PostChargesResult>('/fees/post-charges', { period }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['statement'] })
      toast.success(t('fees.posted', { count: res.inserted, period: res.period }))
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('fees.postCharges')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <Field label={t('fees.postFor')}>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
        <Button disabled={post.isPending || !period} onClick={() => post.mutate()}>
          {t('fees.postCharges')}
        </Button>
      </CardContent>
    </Card>
  )
}
