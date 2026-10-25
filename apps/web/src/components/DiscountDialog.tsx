import { discountSchema, formatPaisa, type ApprovalOutcome, type DueLine } from '@sms/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { api } from '@/lib/api'
import { submitOnCtrlEnter, validate, type FieldErrors } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'
import { rupeesToPaisa } from '@/lib/money'

export function DiscountDialog({
  enrollmentId,
  dues,
  open,
  onOpenChange,
}: {
  enrollmentId: string
  dues: DueLine[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const name = useLocalName()
  const qc = useQueryClient()
  const [line, setLine] = useState(0)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const due = dues[line]

  const give = useMutation({
    mutationFn: (body: unknown) => api.post<ApprovalOutcome>('/fees/discounts', body),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['statement'] })
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      if (res.applied) toast.success(t('discount.applied'))
      else toast.info(t('discount.sent'))
      setAmount('')
      setReason('')
      onOpenChange(false)
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!due) return
    const result = validate(discountSchema, {
      enrollmentId,
      headId: due.headId,
      period: due.period,
      amountPaisa: rupeesToPaisa(amount) ?? Number.NaN,
      reason,
    })
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    give.mutate(result.data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('discount.title')}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
          <Field label={t('discount.line')}>
            <NativeSelect
              className="w-full"
              value={line}
              onChange={(e) => setLine(Number(e.target.value))}
            >
              {dues.map((d, i) => (
                <NativeSelectOption key={`${d.period}:${d.headId}`} value={i}>
                  {d.period} · {name(d.headNameEn, d.headNameUr)} · {formatPaisa(d.amountPaisa)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('discount.amount')} error={errors.amountPaisa && t('errors.invalid')}>
            <Input
              value={amount}
              inputMode="decimal"
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label={t('discount.reason')} error={errors.reason && t('errors.required')}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={give.isPending || !due}>
              {t('app.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
