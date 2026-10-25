import { settingsSchema, type SettingsInput } from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { submitOnCtrlEnter, validate, type FieldErrors } from '@/lib/form'
import { paisaToRupees, rupeesToPaisa } from '@/lib/money'

export function SettingsPage() {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsInput>('/settings'),
  })
  if (!settings.data) return <Skeleton className="h-48 w-full max-w-md" />
  return <SettingsForm initial={settings.data} />
}

function SettingsForm({ initial }: { initial: SettingsInput }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [lockDays, setLockDays] = useState(String(initial.attendanceLockDays))
  const [threshold, setThreshold] = useState(paisaToRupees(initial.discountThresholdPaisa))
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({
    mutationFn: (body: SettingsInput) => api.put<SettingsInput>('/settings', body),
    onSuccess: (res) => {
      qc.setQueryData(['settings'], res)
      toast.success(t('app.saved'))
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const paisa = rupeesToPaisa(threshold)
    const v = validate(settingsSchema, {
      attendanceLockDays: lockDays,
      discountThresholdPaisa: paisa ?? -1,
    })
    setErrors(v.ok ? {} : v.errors)
    if (v.ok) save.mutate(v.data)
  }

  return (
    <form className="grid max-w-md gap-4" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>
      <Field
        label={t('settings.lockDays')}
        error={errors.attendanceLockDays && t('errors.invalid')}
      >
        <Input
          inputMode="numeric"
          value={lockDays}
          autoFocus
          onChange={(e) => setLockDays(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">{t('settings.lockDaysHint')}</span>
      </Field>
      <Field
        label={t('settings.threshold')}
        error={errors.discountThresholdPaisa && t('errors.invalid')}
      >
        <Input
          inputMode="decimal"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">{t('settings.thresholdHint')}</span>
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {t('app.save')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('app.saveHint')}</span>
      </div>
    </form>
  )
}
