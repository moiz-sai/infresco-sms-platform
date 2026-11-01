import {
  backupSettingsSchema,
  RESET_MODULES,
  type BackupFile,
  type BackupRunItem,
  type BackupSummary,
  type ResetModule,
} from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { api, ApiError } from '@/lib/api'
import { errorText } from '@/lib/query'
import { validate, type FieldErrors } from '@/lib/form'

function kb(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function BackupPanel({ backup }: { backup: BackupSummary }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['dev-status'] })
    void qc.invalidateQueries({ queryKey: ['dev-backup'] })
  }
  const files = useQuery({
    queryKey: ['dev-backup', 'files'],
    queryFn: () => api.get<BackupFile[]>('/_dev/backup/files'),
  })
  const runs = useQuery({
    queryKey: ['dev-backup', 'runs'],
    queryFn: () => api.get<BackupRunItem[]>('/_dev/backup/runs'),
  })

  const [form, setForm] = useState({
    primaryDir: backup.primaryDir ?? '',
    secondaryDir: backup.secondaryDir ?? '',
    times: backup.times.join(', '),
    keep: String(backup.keep),
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const saveSettings = useMutation({
    mutationFn: async () => {
      const body = {
        primaryDir: form.primaryDir,
        secondaryDir: form.secondaryDir,
        times: form.times.split(',').map((s) => s.trim()).filter(Boolean),
        keep: form.keep,
      }
      const v = validate(backupSettingsSchema, body)
      if (!v.ok) return setErrors(v.errors)
      setErrors({})
      await api.put('/_dev/backup/settings', v.data)
      toast.success(t('backup.saved'))
      refresh()
    },
  })
  const runNow = useMutation({
    mutationFn: () => api.post('/_dev/backup'),
    onSuccess: () => {
      toast.success(t('backup.done'))
      refresh()
    },
    onError: (e) => toast.error(errorText(e)),
  })
  const restore = useMutation({
    mutationFn: (file: string) => api.post('/_dev/backup/restore', { file }),
    onSuccess: () => {
      toast.success(t('backup.restored'))
      // Restore logs everyone out, including this developer session.
      void qc.invalidateQueries()
    },
    onError: (e) => toast.error(errorText(e)),
  })

  function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    saveSettings.mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('backup.section')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!backup.pgReady && (
          <p className="rounded-md bg-warning-muted p-2 text-sm text-warning-foreground">
            {t('backup.notConfigured')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">{t('backup.lastGood')}:</span>
          <span>
            {backup.lastGoodAt
              ? new Date(backup.lastGoodAt).toLocaleString()
              : t('backup.never')}
          </span>
          <Button
            size="sm"
            className="ms-auto"
            disabled={runNow.isPending || !backup.pgReady}
            onClick={() => runNow.mutate()}
          >
            {runNow.isPending ? t('backup.running') : t('backup.run')}
          </Button>
        </div>

        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSave}>
          <Field label={t('backup.primaryDir')} error={errors.primaryDir}>
            <Input
              value={form.primaryDir}
              onChange={(e) => setForm((f) => ({ ...f, primaryDir: e.target.value }))}
            />
          </Field>
          <Field label={t('backup.secondaryDir')} error={errors.secondaryDir}>
            <Input
              value={form.secondaryDir}
              onChange={(e) => setForm((f) => ({ ...f, secondaryDir: e.target.value }))}
            />
          </Field>
          <Field label={t('backup.times')} error={errors.times}>
            <Input
              value={form.times}
              onChange={(e) => setForm((f) => ({ ...f, times: e.target.value }))}
            />
          </Field>
          <Field label={t('backup.keep')} error={errors.keep}>
            <Input
              inputMode="numeric"
              value={form.keep}
              onChange={(e) => setForm((f) => ({ ...f, keep: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="outline" disabled={saveSettings.isPending}>
              {t('backup.save')}
            </Button>
          </div>
        </form>

        {!!files.data?.length && (
          <div className="grid gap-1">
            <h3 className="text-sm font-medium">{t('backup.files')}</h3>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-start">
                  <tr>
                    <th className="p-2 text-start font-medium">{t('backup.file')}</th>
                    <th className="p-2 text-start font-medium">{t('backup.size')}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {files.data.map((f) => (
                    <tr key={`${f.location}/${f.name}`} className="border-t">
                      <td className="p-2 font-mono text-xs">{f.name}</td>
                      <td className="p-2">{kb(f.bytes)}</td>
                      <td className="p-2 text-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={restore.isPending}
                          onClick={() =>
                            window.confirm(t('backup.restoreConfirm')) && restore.mutate(f.name)
                          }
                        >
                          {t('backup.restore')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!!runs.data?.length && (
          <div className="grid gap-1">
            <h3 className="text-sm font-medium">{t('backup.runs')}</h3>
            <ul className="grid gap-0.5 text-xs text-muted-foreground">
              {runs.data.slice(0, 6).map((r) => (
                <li key={r.id} className="flex gap-2">
                  <span className={r.status === 'failed' ? 'text-destructive' : 'text-success'}>
                    {t(`backup.${r.status}`)}
                  </span>
                  <span>{r.trigger}</span>
                  <span className="ms-auto">{new Date(r.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ResetZone onDone={refresh} />
      </CardContent>
    </Card>
  )
}

function ResetZone({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [module, setModule] = useState<ResetModule>('fees')
  const [confirm, setConfirm] = useState('')
  const reset = useMutation({
    mutationFn: () => api.post('/_dev/reset', { module, confirm }),
    onSuccess: () => {
      toast.success(t('backup.resetDone'))
      setConfirm('')
      onDone()
    },
    onError: (e) =>
      toast.error(e instanceof ApiError && e.code === 'CONFIRM_MISMATCH' ? errorText(e) : errorText(e)),
  })
  return (
    <div className="grid gap-2 rounded-md border border-destructive/40 p-3">
      <h3 className="text-sm font-medium text-destructive">{t('backup.resetSection')}</h3>
      <p className="text-xs text-muted-foreground">{t('backup.resetWarn')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('backup.resetModule')}>
          <NativeSelect value={module} onChange={(e) => setModule(e.target.value as ResetModule)}>
            {RESET_MODULES.map((m) => (
              <option key={m} value={m}>
                {t(`backup.mod.${m}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('backup.resetConfirmLabel')}>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
      </div>
      <div>
        <Button
          variant="destructive"
          disabled={!confirm || reset.isPending}
          onClick={() => reset.mutate()}
        >
          {t('backup.reset')}
        </Button>
      </div>
    </div>
  )
}
