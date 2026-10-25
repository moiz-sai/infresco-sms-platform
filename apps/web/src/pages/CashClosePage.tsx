import { formatPaisa, type CashCloseView } from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loading } from '@/components/Loading'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useFormatDate } from '@/lib/date'
import { submitOnCtrlEnter, today } from '@/lib/form'
import { rupeesToPaisa } from '@/lib/money'
import { cn } from '@/lib/utils'

export function CashClosePage() {
  const { t } = useTranslation()
  const fmt = useFormatDate()
  const qc = useQueryClient()
  const [date, setDate] = useState(today())
  const [counted, setCounted] = useState('')
  const [error, setError] = useState(false)
  const view = useQuery({
    queryKey: ['cash-close', date],
    queryFn: () => api.get<CashCloseView>(`/fees/cash-close/${date}`),
  })
  const close = useMutation({
    mutationFn: (countedTotalPaisa: number) =>
      api.post<CashCloseView>(`/fees/cash-close/${date}`, { countedTotalPaisa }),
    onSuccess: (res) => {
      qc.setQueryData(['cash-close', date], res)
      toast.success(t('cashClose.done'))
      setCounted('')
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const paisa = rupeesToPaisa(counted)
    setError(paisa === null)
    if (paisa !== null) close.mutate(paisa)
  }

  const v = view.data
  return (
    <div className="grid max-w-md gap-4">
      <h1 className="text-xl font-semibold">{t('cashClose.title')}</h1>
      <Field label={t('cashClose.date')}>
        <Input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </Field>
      {view.isPending && <Loading rows={2} />}
      {v && (
        <Card>
          <CardContent className="grid gap-3 pt-6">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{t('cashClose.system')}</span>
              <span className="text-xl font-semibold tabular-nums">
                {formatPaisa(v.systemTotalPaisa)}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {t('cashClose.receipts', { count: v.receiptCount })}
            </span>
            {v.close ? (
              <div className="grid gap-1 border-t pt-3">
                <div className="flex justify-between gap-2">
                  <span>{t('cashClose.counted')}</span>
                  <span className="tabular-nums">{formatPaisa(v.close.countedTotalPaisa)}</span>
                </div>
                <div
                  className={cn(
                    'flex justify-between gap-2 font-semibold',
                    v.close.differencePaisa !== 0 && 'text-danger',
                  )}
                >
                  <span>{t('cashClose.difference')}</span>
                  <span className="tabular-nums">{formatPaisa(v.close.differencePaisa)}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {t('cashClose.closedBy', {
                    name: v.close.closedByName,
                    time: fmt(v.close.createdAt, {
                      timeStyle: 'short',
                    }),
                  })}
                </span>
              </div>
            ) : (
              <form
                className="grid gap-3 border-t pt-3"
                onSubmit={onSubmit}
                onKeyDown={submitOnCtrlEnter}
              >
                <Field
                  label={t('cashClose.counted')}
                  error={error ? t('errors.invalid') : undefined}
                >
                  <Input
                    value={counted}
                    inputMode="decimal"
                    autoFocus
                    className="h-11 text-lg tabular-nums"
                    onChange={(e) => setCounted(e.target.value)}
                  />
                </Field>
                <Button type="submit" disabled={close.isPending}>
                  {t('cashClose.close')}
                </Button>
                <span className="text-xs text-muted-foreground">{t('cashClose.hint')}</span>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
