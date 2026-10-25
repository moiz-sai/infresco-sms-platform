import { formatPaisa, type ApprovalItem, type Page } from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loading } from '@/components/Loading'
import { Field } from '@/components/Field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useFormatDate } from '@/lib/date'
import { submitOnCtrlEnter } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'

type Status = 'pending' | 'approved' | 'rejected'

export function ApprovalsPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>('pending')
  const list = useQuery({
    queryKey: ['approvals', status],
    queryFn: () => api.get<Page<ApprovalItem>>('/approvals', { status, size: 100 }),
  })

  return (
    <div className="grid max-w-3xl gap-4">
      <h1 className="text-xl font-semibold">{t('approvals.title')}</h1>
      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
        <TabsList>
          {(['pending', 'approved', 'rejected'] as const).map((s) => (
            <TabsTrigger key={s} value={s}>
              {t(`approvals.${s}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {list.data?.items.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t('approvals.empty')}
        </p>
      )}
      {list.isPending && <Loading />}
      {list.data?.items.map((item) => (
        <ApprovalCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function ApprovalCard({ item }: { item: ApprovalItem }) {
  const { t } = useTranslation()
  const fmt = useFormatDate()
  const name = useLocalName()
  const qc = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const d = item.payload.display ?? {}
  const refresh = () => {
    for (const key of [
      'approvals',
      'statement',
      'attendance',
      'students',
      'receipt',
      'approvals-count',
    ]) {
      void qc.invalidateQueries({ queryKey: [key] })
    }
  }
  const approve = useMutation({
    mutationFn: () => api.post(`/approvals/${item.id}/approve`),
    onSuccess: () => {
      refresh()
      toast.success(t('approvals.approvedToast'))
    },
  })

  const student = d.studentNameEn && (
    <span>
      {name(d.studentNameEn, d.studentNameUr)}
      {d.admissionNo && <span className="text-muted-foreground"> · {d.admissionNo}</span>}
    </span>
  )

  return (
    <div className="grid gap-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{t(`approvals.actions.${item.action}`)}</Badge>
        <span className="text-sm text-muted-foreground">
          {t('approvals.requestedBy', { name: item.requestedByName })} ·{' '}
          {fmt(item.createdAt, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      </div>

      <div className="grid gap-1 text-sm">
        {item.action === 'fees.discount' && (
          <>
            <div className="font-medium">
              {student} — {formatPaisa(d.amountPaisa ?? 0)} · {d.headCode}
              {d.period && ` · ${d.period}`}
            </div>
            {d.kind === 'plan' && (
              <div className="text-muted-foreground">{t('approvals.planDiscount')}</div>
            )}
          </>
        )}
        {item.action === 'fees.reverse' && (
          <div className="font-medium">
            {d.receiptNo} — {formatPaisa(d.amountPaisa ?? 0)} · {student}
          </div>
        )}
        {item.action === 'attendance.edit_old' && (
          // Requests saved before display info existed fall back to the raw payload.
          <div className="font-medium">
            {[
              d.sectionName,
              d.date ?? (item.payload.date as string | undefined),
              t('approvals.changes', {
                count: d.count ?? (item.payload.entries as unknown[] | undefined)?.length ?? 0,
              }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
        {item.action === 'students.promote' && (
          <>
            <div className="font-medium">
              {d.fromSection} → {d.toSection} ·{' '}
              {t('approvals.studentsOwing', { count: d.count ?? 0 })}
            </div>
            <ul className="text-muted-foreground">
              {d.students?.map((s) => (
                <li key={s.admissionNo}>
                  {name(s.nameEn, s.nameUr)} · {s.admissionNo} · {formatPaisa(s.balancePaisa)}
                </li>
              ))}
            </ul>
          </>
        )}
        {d.reason && (
          <div>
            <span className="text-muted-foreground">{t('approvals.reason')}: </span>
            {d.reason}
          </div>
        )}
      </div>

      {item.status === 'pending' ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate()}>
            <Check />
            {t('approvals.approve')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
            <X />
            {t('approvals.reject')}
          </Button>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {t('approvals.decidedBy', {
            status: t(`approvals.${item.status}`),
            name: item.decidedByName ?? '',
          })}
          {item.reason && ` — ${item.reason}`}
        </div>
      )}
      <RejectDialog id={item.id} open={rejecting} onOpenChange={setRejecting} onDone={refresh} />
    </div>
  )
}

function RejectDialog({
  id,
  open,
  onOpenChange,
  onDone,
}: {
  id: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const reject = useMutation({
    mutationFn: () => api.post(`/approvals/${id}/reject`, { reason }),
    onSuccess: () => {
      onDone()
      toast.success(t('approvals.rejectedToast'))
      onOpenChange(false)
    },
  })
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (reason.trim()) reject.mutate()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('approvals.reject')}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
          <Field label={t('approvals.rejectReason')}>
            <Input value={reason} autoFocus onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={reject.isPending || !reason.trim()}
            >
              {t('approvals.reject')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
