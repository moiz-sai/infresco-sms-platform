import { loginSchema, type Me } from '@sms/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { BrandMark } from '@/components/Brand'
import { Field } from '@/components/Field'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api'
import { homePath, useMe } from '@/lib/auth'
import { submitOnCtrlEnter, validate, type FieldErrors } from '@/lib/form'

export function LoginPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: me } = useMe()
  const [errors, setErrors] = useState<FieldErrors>({})
  const from = (location.state as { from?: string } | null)?.from
  const login = useMutation({
    mutationFn: (body: unknown) => api.post<Me>('/auth/login', body),
    onSuccess: (user) => {
      qc.setQueryData(['me'], user)
      void navigate(from ?? homePath(user), { replace: true })
    },
  })

  if (me) return <Navigate to={from ?? homePath(me)} replace />

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = validate(loginSchema, Object.fromEntries(new FormData(e.currentTarget)))
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    login.mutate(result.data)
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/40 p-4">
      <BrandMark className="flex-col gap-2 text-center" logoClassName="h-14" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('login.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {login.error instanceof ApiError && login.error.code === 'LICENSE_LOCKED' && (
            <p className="mb-3 rounded-md bg-danger/10 p-2 text-sm text-danger">
              {t('license.locked')}
            </p>
          )}
          <form className="grid gap-4" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
            <Field label={t('login.username')} error={errors.username}>
              <Input name="username" autoComplete="username" autoFocus />
            </Field>
            <Field label={t('login.password')} error={errors.password}>
              <Input name="password" type="password" autoComplete="current-password" />
            </Field>
            <Button type="submit" disabled={login.isPending}>
              {t('login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
      <LanguageToggle />
    </div>
  )
}
