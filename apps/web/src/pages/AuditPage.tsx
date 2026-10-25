import type { AuditItem, Page, UserItem } from '@sms/shared'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { api } from '@/lib/api'
import { useCan } from '@/lib/auth'
import { useLocalName } from '@/lib/i18n-helpers'

const ENTITIES = [
  'person',
  'enrollment',
  'section',
  'receipt',
  'ledger_entry',
  'cash_close',
  'approval_request',
  'user_account',
  'school',
  'class',
  'academic_year',
  'fee_head',
  'fee_structure',
  'student_fee_plan',
]
const SIZE = 50

export function AuditPage() {
  const { t } = useTranslation()
  const name = useLocalName()
  const can = useCan()
  const [params, setParams] = useSearchParams()
  const filters = {
    userId: params.get('userId') ?? '',
    entity: params.get('entity') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  }
  const page = Number(params.get('page') ?? 1)
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserItem[]>('/users'),
    enabled: can('users.manage'),
  })
  const audit = useQuery({
    queryKey: ['audit', filters, page],
    queryFn: () => api.get<Page<AuditItem>>('/audit', { ...filters, page, size: SIZE }),
  })
  const setParam = (k: string, v: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (v) next.set(k, v)
      else next.delete(k)
      if (k !== 'page') next.delete('page')
      return next
    })
  const pages = Math.max(1, Math.ceil((audit.data?.total ?? 0) / SIZE))

  return (
    <div className="grid max-w-5xl gap-4">
      <h1 className="text-xl font-semibold">{t('audit.title')}</h1>
      <div className="flex flex-wrap items-end gap-3">
        {users.data && (
          <Field label={t('audit.user')} className="min-w-40">
            <NativeSelect
              value={filters.userId}
              onChange={(e) => setParam('userId', e.target.value)}
            >
              <NativeSelectOption value="">{t('audit.all')}</NativeSelectOption>
              {users.data.map((u) => (
                <NativeSelectOption key={u.id} value={u.id}>
                  {name(u.nameEn, u.nameUr)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label={t('audit.entity')} className="min-w-40">
          <NativeSelect value={filters.entity} onChange={(e) => setParam('entity', e.target.value)}>
            <NativeSelectOption value="">{t('audit.all')}</NativeSelectOption>
            {ENTITIES.map((e) => (
              <NativeSelectOption key={e} value={e}>
                {t(`audit.entities.${e}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('audit.from')}>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setParam('from', e.target.value)}
          />
        </Field>
        <Field label={t('audit.to')}>
          <Input type="date" value={filters.to} onChange={(e) => setParam('to', e.target.value)} />
        </Field>
      </div>

      {audit.data?.items.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t('audit.empty')}
        </p>
      )}
      <ul className="grid divide-y rounded-lg border">
        {audit.data?.items.map((a) => (
          <li key={a.id}>
            <details className="group px-3 py-2">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="w-36 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {new Date(a.createdAt).toLocaleString('en-GB', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </span>
                <span className="w-32 shrink-0 text-sm font-medium">
                  {a.userName ?? t('audit.system')}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <bdi>{a.summary}</bdi>
                </span>
              </summary>
              <pre
                dir="ltr"
                className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap"
              >
                {`${a.action} · ${a.entity}${a.entityId ? ` · ${a.entityId}` : ''}\n`}
                {a.before !== null && `before: ${JSON.stringify(a.before, null, 1)}\n`}
                {a.after !== null && `after: ${JSON.stringify(a.after, null, 1)}`}
              </pre>
            </details>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t('audit.prev')}
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
          >
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <span className="text-sm tabular-nums">
            {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label={t('audit.next')}
            disabled={page >= pages}
            onClick={() => setParam('page', String(page + 1))}
          >
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  )
}
