import { brandingSchema, type DeveloperStatus } from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'
import { BackupPanel } from '@/components/DeveloperBackup'
import { logoUrl } from '@/lib/branding'
import { errorText } from '@/lib/query'
import { submitOnCtrlEnter, validate, type FieldErrors } from '@/lib/form'

// The developer profile. Reached only by its address (/_infresco); never linked from the app.
export function DeveloperPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const status = useQuery({
    queryKey: ['dev-status'],
    queryFn: () => api.get<DeveloperStatus>('/_dev/status'),
    retry: false,
  })
  const unlocked = status.isSuccess
  const needsUnlock =
    status.isError && status.error instanceof ApiError && status.error.status === 401

  return (
    <div className="mx-auto grid max-w-2xl gap-4 p-4 md:p-8">
      <div className="flex items-center gap-2">
        <h1 className="me-auto text-xl font-semibold">{t('dev.title')}</h1>
        <LanguageToggle />
        {unlocked && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await api.post('/_dev/lock')
              await qc.invalidateQueries({ queryKey: ['dev-status'] })
            }}
          >
            {t('dev.lock')}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t('dev.subtitle')}</p>
      {status.isPending && <p className="text-sm text-muted-foreground">…</p>}
      {needsUnlock && <UnlockCard onDone={() => qc.invalidateQueries({ queryKey: ['dev-status'] })} />}
      {unlocked && status.data && <Console data={status.data} />}
    </div>
  )
}

function UnlockCard({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [signature, setSignature] = useState('')
  const getCode = useMutation({
    mutationFn: () => api.post<{ code: string; installId: string }>('/_dev/challenge'),
    onSuccess: (r) => setCode(r.code),
  })
  const unlock = useMutation({
    mutationFn: () => api.post('/_dev/unlock', { code, signature }),
    onSuccess: onDone,
    onError: (e) => toast.error(e instanceof ApiError ? t('dev.unlockFailed') : errorText(e)),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dev.unlock')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button variant="outline" onClick={() => getCode.mutate()} disabled={getCode.isPending}>
          {t('dev.getCode')}
        </Button>
        {code && (
          <>
            <Field label={t('dev.code')}>
              <Textarea readOnly value={code} rows={2} className="font-mono text-xs" />
            </Field>
            <p className="text-xs text-muted-foreground">{t('dev.codeHint')}</p>
            <Field label={t('dev.signature')}>
              <Textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                rows={2}
                className="font-mono text-xs"
              />
            </Field>
            <Button onClick={() => unlock.mutate()} disabled={!signature || unlock.isPending}>
              {t('dev.unlock')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Console({ data }: { data: DeveloperStatus }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-1 pt-6 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('dev.install')}</span>
            <span className="font-mono text-xs">{data.installId}</span>
          </div>
        </CardContent>
      </Card>
      <LicensePanel data={data} />
      <BrandingPanel data={data} />
      <BackupPanel backup={data.backup} />
    </div>
  )
}

function LicensePanel({ data }: { data: DeveloperStatus }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [license, setLicense] = useState('')
  const [signature, setSignature] = useState('')
  const lic = data.license
  const stateLabel = {
    licensed: t('dev.licensedState'),
    trial: t('dev.trial'),
    expired: t('dev.expiredState'),
    none: t('dev.noneState'),
  }[lic.state]
  const apply = useMutation({
    mutationFn: () => api.put('/_dev/license', { license, signature }),
    onSuccess: async () => {
      toast.success(t('dev.licenseApplied'))
      setLicense('')
      setSignature('')
      await qc.invalidateQueries()
    },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dev.licenseSection')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="grid gap-1">
          <Row label={t('dev.state')} value={stateLabel} />
          {lic.school && <Row label={t('dev.school')} value={lic.school} />}
          {lic.expires && <Row label={t('dev.expires')} value={lic.expires} />}
          {lic.daysLeft !== null && <Row label={t('dev.daysLeft')} value={String(lic.daysLeft)} />}
        </div>
        <Field label={t('dev.pasteLicense')}>
          <Textarea
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            rows={3}
            className="font-mono text-xs"
          />
        </Field>
        <Field label={t('dev.pasteSignature')}>
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={2}
            className="font-mono text-xs"
          />
        </Field>
        <Button onClick={() => apply.mutate()} disabled={!license || !signature || apply.isPending}>
          {t('dev.applyLicense')}
        </Button>
      </CardContent>
    </Card>
  )
}

function BrandingPanel({ data }: { data: DeveloperStatus }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const b = data.branding
  const [form, setForm] = useState({
    nameEn: b.nameEn,
    nameUr: b.nameUr ?? '',
    address: b.address ?? '',
    phone: b.phone ?? '',
    footerEn: b.footerEn ?? '',
    footerUr: b.footerUr ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['dev-status'] })
    await qc.invalidateQueries({ queryKey: ['branding'] })
  }
  const save = useMutation({
    mutationFn: async () => {
      const v = validate(brandingSchema, form)
      if (!v.ok) return setErrors(v.errors)
      await api.put('/_dev/branding', v.data)
      toast.success(t('dev.brandingSaved'))
      await refresh()
    },
  })
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const data64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('read failed'))
        reader.readAsDataURL(file)
      })
      await api.put('/_dev/logo', { type: file.type, data: data64 })
      toast.success(t('dev.logoSaved'))
      await refresh()
    },
    onError: (e) =>
      toast.error(e instanceof ApiError && e.code === 'LOGO_TOO_LARGE' ? t('dev.logoTooLarge') : errorText(e)),
  })
  const removeLogo = useMutation({
    mutationFn: () => api.del('/_dev/logo'),
    onSuccess: async () => {
      toast.success(t('dev.logoRemoved'))
      await refresh()
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    save.mutate()
  }

  const src = logoUrl(b)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dev.brandingSection')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-3">
          {src ? (
            <img src={src} alt="" className="h-12 w-auto rounded border object-contain" />
          ) : (
            <div className="grid h-12 w-12 place-content-center rounded border text-xs text-muted-foreground">
              {t('dev.logo')}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload.mutate(f)
              e.target.value = ''
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            {t('dev.chooseLogo')}
          </Button>
          {b.hasLogo && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => removeLogo.mutate()}
            >
              {t('dev.removeLogo')}
            </Button>
          )}
        </div>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
          <Field label={t('setup.nameEn')} error={errors.nameEn}>
            <Input value={form.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />
          </Field>
          <Field label={t('setup.nameUr')} error={errors.nameUr}>
            <Input
              dir="rtl"
              lang="ur"
              className="font-urdu"
              value={form.nameUr}
              onChange={(e) => set({ nameUr: e.target.value })}
            />
          </Field>
          <Field label={t('setup.address')} error={errors.address}>
            <Input value={form.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label={t('setup.phone')} error={errors.phone}>
            <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label={t('dev.footerEn')} error={errors.footerEn}>
            <Input value={form.footerEn} onChange={(e) => set({ footerEn: e.target.value })} />
          </Field>
          <Field label={t('dev.footerUr')} error={errors.footerUr}>
            <Input
              dir="rtl"
              lang="ur"
              className="font-urdu"
              value={form.footerUr}
              onChange={(e) => set({ footerUr: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending}>
              {t('app.save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end">{value}</span>
    </div>
  )
}
