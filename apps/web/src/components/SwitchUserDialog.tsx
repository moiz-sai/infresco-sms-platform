import { switchUserSchema, type Me } from '@sms/shared'
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
import { api } from '@/lib/api'
import { submitOnCtrlEnter, validate, type FieldErrors } from '@/lib/form'

export function SwitchUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [errors, setErrors] = useState<FieldErrors>({})
  const mutation = useMutation({
    mutationFn: (body: unknown) => api.post<Me>('/auth/switch', body),
    onSuccess: (me) => {
      qc.clear()
      qc.setQueryData(['me'], me)
      toast.success(t('switch.done', { name: me.nameEn }))
      onOpenChange(false)
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const result = validate(switchUserSchema, Object.fromEntries(form))
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    mutation.mutate(result.data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('switch.title')}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
          <Field label={t('login.username')} error={errors.username}>
            <Input name="username" autoComplete="off" autoFocus />
          </Field>
          <Field label={t('switch.pin')} error={errors.pin}>
            <Input name="pin" type="password" inputMode="numeric" maxLength={6} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {t('switch.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
