import { PERMISSION_MODULES, PRINCIPAL_ONLY, roleCreateSchema, type RoleItem } from '@sms/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Fragment, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useLocalName } from '@/lib/i18n-helpers'
import { cn } from '@/lib/utils'

type Grants = Record<string, string[]>

const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join()

// SPEC §T12: one row per module (expand for each action), one column per role.
export function RolesPanel({ roles }: { roles: RoleItem[] }) {
  const { t } = useTranslation()
  const name = useLocalName()
  const qc = useQueryClient()
  const initial = Object.fromEntries(roles.map((r) => [r.id, r.permissions]))
  const [grants, setGrants] = useState<Grants>(initial)
  const [open, setOpen] = useState<string[]>([])
  const [dialog, setDialog] = useState<RoleItem | 'new' | null>(null)
  const dirty = roles.filter((r) => !r.locked && !same(grants[r.id] ?? [], r.permissions))

  const has = (r: RoleItem, code: string) => r.locked || (grants[r.id] ?? []).includes(code)
  const set = (r: RoleItem, codes: readonly string[], on: boolean) =>
    setGrants((g) => {
      const current = new Set(g[r.id] ?? [])
      for (const c of codes) {
        if (on) current.add(c)
        else current.delete(c)
      }
      return { ...g, [r.id]: [...current] }
    })

  const save = useMutation({
    mutationFn: async () => {
      for (const r of dirty) {
        await api.put(`/roles/${r.id}`, {
          nameEn: r.nameEn,
          nameUr: r.nameUr,
          permissions: grants[r.id],
        })
      }
    },
    onSuccess: () => {
      toast.success(t('roles.saved'))
      void qc.invalidateQueries({ queryKey: ['roles'] })
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
  const remove = useMutation({
    mutationFn: (r: RoleItem) => api.del(`/roles/${r.id}`),
    onSuccess: () => {
      toast.success(t('app.deleted'))
      void qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })

  return (
    <div
      className="grid gap-3"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.ctrlKey && dirty.length) {
          e.preventDefault()
          save.mutate()
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="me-auto max-w-xl text-sm text-muted-foreground">{t('roles.hint')}</p>
        <Button variant="outline" onClick={() => setDialog('new')}>
          <Plus />
          {t('roles.add')}
        </Button>
        <Button disabled={!dirty.length || save.isPending} onClick={() => save.mutate()}>
          {t('app.save')}
        </Button>
      </div>
      {dirty.length > 0 && <p className="text-sm text-warning">{t('roles.unsaved')}</p>}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-start font-medium">{t('roles.module')}</th>
              {roles.map((r) => (
                <th key={r.id} className="min-w-28 p-2 text-center font-medium">
                  <div className="flex items-center justify-center gap-1">
                    {r.locked && <Lock className="size-3.5" />}
                    {name(r.nameEn, r.nameUr)}
                  </div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {r.locked ? t('roles.locked') : t('roles.users', { count: r.userCount })}
                  </div>
                  {!r.locked && (
                    <div className="mt-1 flex justify-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t('roles.rename')}
                        onClick={() => setDialog(r)}
                      >
                        <Pencil />
                      </Button>
                      {!r.builtIn && r.userCount === 0 && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive"
                          aria-label={t('app.delete')}
                          onClick={() =>
                            window.confirm(t('roles.confirmDelete')) && remove.mutate(r)
                          }
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((m) => {
              const expanded = open.includes(m.module)
              const grantable = m.codes.filter((c) => !PRINCIPAL_ONLY.includes(c))
              return (
                <Fragment key={m.module}>
                  <tr className="border-t bg-muted/20">
                    <td className="p-2">
                      <button
                        type="button"
                        className="flex items-center gap-1 font-medium"
                        aria-label={expanded ? t('roles.collapse') : t('roles.expand')}
                        onClick={() =>
                          setOpen((o) =>
                            expanded ? o.filter((x) => x !== m.module) : [...o, m.module],
                          )
                        }
                      >
                        {expanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4 rtl:rotate-180" />
                        )}
                        {t(`module.${m.module}`)}
                      </button>
                    </td>
                    {roles.map((r) => {
                      const count = m.codes.filter((c) => has(r, c)).length
                      return (
                        <td key={r.id} className="p-2 text-center">
                          <Checkbox
                            className="mx-auto"
                            disabled={r.locked || grantable.length === 0}
                            checked={
                              count === m.codes.length ? true : count ? 'indeterminate' : false
                            }
                            onCheckedChange={(c) => set(r, grantable, c === true)}
                            aria-label={`${name(r.nameEn, r.nameUr)}: ${t(`module.${m.module}`)}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                  {expanded &&
                    m.codes.map((code) => {
                      const reserved = PRINCIPAL_ONLY.includes(code)
                      return (
                        <tr key={code} className="border-t">
                          <td className="p-2 ps-8">
                            {t(`perm.${code}`)}
                            {reserved && (
                              <span className="ms-2 text-xs text-muted-foreground">
                                ({t('roles.principalOnly')})
                              </span>
                            )}
                          </td>
                          {roles.map((r) => (
                            <td key={r.id} className={cn('p-2 text-center')}>
                              <Checkbox
                                className="mx-auto"
                                disabled={r.locked || reserved}
                                checked={has(r, code)}
                                onCheckedChange={(c) => set(r, [code], c === true)}
                                aria-label={`${name(r.nameEn, r.nameUr)}: ${t(`perm.${code}`)}`}
                              />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {dialog && (
        <RoleDialog
          role={dialog === 'new' ? null : dialog}
          grants={dialog === 'new' ? [] : (grants[dialog.id] ?? [])}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function RoleDialog({
  role,
  grants,
  onClose,
}: {
  role: RoleItem | null
  grants: string[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [form, setForm] = useState({ nameEn: role?.nameEn ?? '', nameUr: role?.nameUr ?? '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({
    mutationFn: async () => {
      const v = validate(roleCreateSchema, { ...form, permissions: grants })
      if (!v.ok) return setErrors(v.errors)
      if (role) await api.put(`/roles/${role.id}`, v.data)
      else await api.post('/roles', v.data)
      toast.success(t('app.saved'))
      void qc.invalidateQueries({ queryKey: ['roles'] })
      onClose()
    },
  })
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    save.mutate()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? t('roles.rename') : t('roles.add')}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('student.nameEn')} error={errors.nameEn}>
              <Input
                autoFocus
                value={form.nameEn}
                onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
              />
            </Field>
            <Field label={t('student.nameUr')} error={errors.nameUr}>
              <Input
                dir="rtl"
                lang="ur"
                className="font-urdu"
                value={form.nameUr}
                onChange={(e) => setForm((f) => ({ ...f, nameUr: e.target.value }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <span className="me-auto self-center text-xs text-muted-foreground">
              {t('app.saveHint')}
            </span>
            <Button type="submit" disabled={save.isPending}>
              {t('app.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
