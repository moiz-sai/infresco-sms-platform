import { formatPaisa, type PromoteCandidate, type PromoteResult, type Year } from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { SectionSelect } from '@/components/SectionSelect'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useCan } from '@/lib/auth'
import { submitOnCtrlEnter } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'

// SPEC §Z5: from-section → to-section, everyone ticked, untick to keep behind; one request.
export function PromotePage() {
  const { t } = useTranslation()
  const [fromId, setFromId] = useState('')
  const [toYearId, setToYearId] = useState('')
  const [toId, setToId] = useState('')
  const years = useQuery({ queryKey: ['years'], queryFn: () => api.get<Year[]>('/years') })
  // Default target: the year after the current one, else the current year.
  const sorted = [...(years.data ?? [])].sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  const current = sorted.findIndex((y) => y.isCurrent)
  const yearId = toYearId || (sorted[current + 1] ?? sorted[current])?.id || ''

  return (
    <div className="grid max-w-3xl gap-4">
      <h1 className="text-xl font-semibold">{t('promote.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('promote.from')}>
          <SectionSelect value={fromId} onChange={setFromId} />
        </Field>
        <Field label={t('promote.toYear')}>
          <NativeSelect
            className="w-full"
            value={yearId}
            onChange={(e) => {
              setToYearId(e.target.value)
              setToId('')
            }}
          >
            {sorted.map((y) => (
              <NativeSelectOption key={y.id} value={y.id}>
                {y.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('promote.to')}>
          <SectionSelect value={toId} onChange={setToId} yearId={yearId || undefined} />
        </Field>
      </div>
      {fromId && <Candidates key={fromId} fromId={fromId} toId={toId} />}
    </div>
  )
}

function Candidates({ fromId, toId }: { fromId: string; toId: string }) {
  const { t } = useTranslation()
  const name = useLocalName()
  const can = useCan()
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['promote-candidates', fromId],
    queryFn: () =>
      api.get<PromoteCandidate[]>('/enrollments/promote/candidates', { sectionId: fromId }),
  })
  // Everyone starts ticked; this set holds the ones kept behind.
  const [kept, setKept] = useState<Set<string>>(new Set())
  const rows = list.data ?? []
  const selected = rows.filter((r) => !kept.has(r.studentId))
  const owing = selected.filter((r) => r.balancePaisa > 0)
  const promote = useMutation({
    mutationFn: () =>
      api.post<PromoteResult>('/enrollments/promote', {
        fromSectionId: fromId,
        toSectionId: toId,
        studentIds: selected.map((r) => r.studentId),
      }),
    onSuccess: (res) => {
      for (const key of ['promote-candidates', 'students', 'approvals-count', 'dashboard']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
      setKept(new Set())
      if (res.pendingCount > 0) {
        toast.info(t('promote.pending', { promoted: res.promoted, count: res.pendingCount }))
      } else {
        toast.success(t('promote.done', { count: res.promoted }))
      }
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!toId || toId === fromId) return toast.error(t('promote.sameSection'))
    if (selected.length) promote.mutate()
  }
  const toggle = (studentId: string, on: boolean) =>
    setKept((k) => {
      const next = new Set(k)
      if (on) next.delete(studentId)
      else next.add(studentId)
      return next
    })

  if (list.isPending) return <Skeleton className="h-40 w-full" />
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        {t('promote.empty')}
      </p>
    )
  }
  return (
    <form className="grid gap-3" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
      <p className="text-sm text-muted-foreground">{t('promote.hint')}</p>
      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={kept.size === 0 ? true : selected.length === 0 ? false : 'indeterminate'}
          onCheckedChange={(c) =>
            setKept(c === true ? new Set() : new Set(rows.map((r) => r.studentId)))
          }
          aria-label={t('promote.selectAll')}
        />
        <span>{t('promote.count', { selected: selected.length, total: rows.length })}</span>
      </div>
      <ul className="divide-y rounded-lg border">
        {rows.map((r) => (
          <li key={r.studentId}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
              <Checkbox
                checked={!kept.has(r.studentId)}
                onCheckedChange={(c) => toggle(r.studentId, c === true)}
              />
              <span className="w-8 text-sm text-muted-foreground tabular-nums">
                {r.rollNo ?? ''}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <bdi>{name(r.nameEn, r.nameUr)}</bdi>
                <span className="ms-2 text-xs text-muted-foreground">{r.admissionNo}</span>
              </span>
              {r.balancePaisa > 0 && (
                <span className="text-sm text-danger tabular-nums">
                  {t('promote.owes', { amount: formatPaisa(r.balancePaisa) })}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      {owing.length > 0 && !can('approvals.decide') && (
        <p className="rounded-lg border border-warning-border bg-warning-muted p-3 text-sm text-warning-foreground">
          {t('promote.owingNote')}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={promote.isPending || selected.length === 0}>
          <ArrowRightLeft />
          {t('promote.submit')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('app.saveHint')}</span>
      </div>
    </form>
  )
}
