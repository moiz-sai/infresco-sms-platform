import {
  userCreateSchema,
  userResetSchema,
  userUpdateSchema,
  type RoleItem,
  type UserItem,
} from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { submitOnCtrlEnter, validate, type FieldErrors } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'

export function UsersPage() {
  const { t } = useTranslation()
  const name = useLocalName()
  const [editing, setEditing] = useState<UserItem | 'new' | null>(null)
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<UserItem[]>('/users') })
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api.get<RoleItem[]>('/roles') })

  return (
    <div className="grid max-w-4xl gap-4">
      <div className="flex items-center gap-2">
        <h1 className="me-auto text-xl font-semibold">{t('users.title')}</h1>
        <Button onClick={() => setEditing('new')}>
          <UserPlus />
          {t('users.add')}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('users.username')}</TableHead>
            <TableHead>{t('users.name')}</TableHead>
            <TableHead>{t('users.roles')}</TableHead>
            <TableHead>{t('student.statusCol')}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.data?.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-mono text-sm">{u.username}</TableCell>
              <TableCell>{name(u.nameEn, u.nameUr)}</TableCell>
              <TableCell className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <Badge key={r.id} variant="secondary">
                    {name(r.nameEn, r.nameUr)}
                  </Badge>
                ))}
              </TableCell>
              <TableCell>
                {!u.isActive ? (
                  <Badge variant="outline">{t('users.disabled')}</Badge>
                ) : u.locked ? (
                  <Badge variant="destructive">{t('users.locked')}</Badge>
                ) : (
                  <Badge>{t('users.active')}</Badge>
                )}
              </TableCell>
              <TableCell className="text-end">
                <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                  <Pencil />
                  {t('app.edit')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editing && roles.data && (
        <UserDialog
          key={editing === 'new' ? 'new' : editing.id}
          user={editing === 'new' ? null : editing}
          roles={roles.data}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function UserDialog({
  user,
  roles,
  onClose,
}: {
  user: UserItem | null
  roles: RoleItem[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const name = useLocalName()
  const qc = useQueryClient()
  const { data: me } = useMe()
  const isSelf = user?.id === me?.id
  const [form, setForm] = useState({
    username: user?.username ?? '',
    nameEn: user?.nameEn ?? '',
    nameUr: user?.nameUr ?? '',
    password: '',
    pin: '',
    isActive: user?.isActive ?? true,
    roleIds: user?.roles.map((r) => r.id) ?? [],
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['users'] })
    toast.success(msg)
    onClose()
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) {
        const v = validate(userCreateSchema, form)
        if (!v.ok) return setErrors(v.errors)
        await api.post('/users', v.data)
        return done(t('users.created'))
      }
      const v = validate(userUpdateSchema, form)
      if (!v.ok || form.roleIds.length === 0) {
        return setErrors({
          ...(v.ok ? {} : v.errors),
          ...(form.roleIds.length ? {} : { roleIds: t('users.pickRole') }),
        })
      }
      await api.put(`/users/${user.id}`, v.data)
      const before = user.roles
        .map((r) => r.id)
        .sort()
        .join()
      if ([...form.roleIds].sort().join() !== before) {
        await api.put(`/users/${user.id}/roles`, { roleIds: form.roleIds })
      }
      done(t('app.saved'))
    },
  })
  const reset = useMutation({
    mutationFn: async () => {
      const body = { password: form.password || undefined, pin: form.pin || undefined }
      const v = validate(userResetSchema, body)
      if (!v.ok) return setErrors({ ...v.errors, password: v.errors.password ?? v.errors[''] })
      await api.post(`/users/${user!.id}/reset`, v.data)
      done(t('users.resetDone'))
    },
  })
  const remove = useMutation({
    mutationFn: () => api.del(`/users/${user!.id}`),
    onSuccess: () => done(t('app.deleted')),
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    save.mutate()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-svh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? user.username : t('users.add')}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
          {!user && (
            <Field label={t('users.username')} error={errors.username}>
              <Input
                value={form.username}
                autoFocus
                autoComplete="off"
                onChange={(e) => set({ username: e.target.value })}
              />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('student.nameEn')} error={errors.nameEn}>
              <Input value={form.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />
            </Field>
            <Field label={t('student.nameUr')} error={errors.nameUr}>
              <Input
                dir="rtl"
                lang="ur"
                className="font-urdu"
                value={form.nameUr}
                onChange={(e) => set({ nameUr: e.target.value })}
              />
            </Field>
          </div>
          {!user && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('users.password')} error={errors.password}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                />
              </Field>
              <Field label={t('users.pin')} error={errors.pin}>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.pin}
                  onChange={(e) => set({ pin: e.target.value })}
                />
              </Field>
            </div>
          )}
          <fieldset className="grid gap-2 text-sm">
            <legend className="mb-1 font-medium">{t('users.roles')}</legend>
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-2">
                <Checkbox
                  checked={form.roleIds.includes(r.id)}
                  onCheckedChange={(c) =>
                    set({
                      roleIds: c
                        ? [...form.roleIds, r.id]
                        : form.roleIds.filter((id) => id !== r.id),
                    })
                  }
                />
                {name(r.nameEn, r.nameUr)}
                <span className="text-xs text-muted-foreground">
                  {t('users.permissionCount', { count: r.permissions.length })}
                </span>
              </label>
            ))}
            {errors.roleIds && <span className="text-xs text-destructive">{errors.roleIds}</span>}
          </fieldset>
          {user && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                disabled={isSelf}
                onCheckedChange={(c) => set({ isActive: c === true })}
              />
              {t('users.activeLabel')}
              <span className="text-xs text-muted-foreground">{t('users.disableHint')}</span>
            </label>
          )}
          <DialogFooter>
            <span className="me-auto self-center text-xs text-muted-foreground">
              {t('app.saveHint')}
            </span>
            <Button type="submit" disabled={save.isPending}>
              {t('app.save')}
            </Button>
          </DialogFooter>
        </form>

        {user && (
          <div className="grid gap-3 border-t pt-3">
            <h3 className="text-sm font-medium">{t('users.reset')}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('users.newPassword')} error={errors.password}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                />
              </Field>
              <Field label={t('users.newPin')} error={errors.pin}>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.pin}
                  onChange={(e) => set({ pin: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={reset.isPending}
                onClick={() => {
                  setErrors({})
                  reset.mutate()
                }}
              >
                <KeyRound />
                {t('users.resetButton')}
              </Button>
              {!isSelf && (
                <Button
                  variant="ghost"
                  className="ms-auto text-destructive"
                  disabled={remove.isPending}
                  onClick={() => window.confirm(t('users.confirmDelete')) && remove.mutate()}
                >
                  <Trash2 />
                  {t('app.delete')}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
