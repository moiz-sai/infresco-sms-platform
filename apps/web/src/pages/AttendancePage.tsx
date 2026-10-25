import {
  attendanceStatuses,
  type AttendanceDay,
  type AttendanceSaveResult,
  type AttendanceStatus,
} from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Loading } from '@/components/Loading'
import { Field } from '@/components/Field'
import { SectionSelect } from '@/components/SectionSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { today } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'
import { useSections } from '@/lib/setup-queries'
import { storage } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { uuid } from '@/lib/uuid'

// Unsaved choices per student; `id` is reused on retry so the server stays idempotent.
type Draft = Record<string, { status: AttendanceStatus; id: string }>

const KEY_TO_STATUS: Record<string, AttendanceStatus> = {
  KeyP: 'P',
  KeyA: 'A',
  KeyL: 'L',
  KeyV: 'V',
}

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  P: 'bg-success text-white border-success',
  A: 'bg-danger text-white border-danger',
  L: 'bg-warning text-white border-warning',
  V: 'bg-info text-white border-info',
}

const draftKey = (sectionId: string, date: string) => `sms.att.${sectionId}.${date}`

export function AttendancePage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const sections = useSections()
  const sectionId = params.get('sectionId') ?? sections.data?.[0]?.id ?? ''
  const date = params.get('date') ?? today()
  const setParam = (patch: Record<string, string>) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      for (const [k, v] of Object.entries(patch)) next.set(k, v)
      return next
    })

  return (
    <div className="grid max-w-3xl gap-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="me-auto text-xl font-semibold">{t('attendance.title')}</h1>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/attendance/register?sectionId=${sectionId}&month=${date.slice(0, 7)}`}>
            <CalendarDays />
            {t('attendance.register')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Field label={t('attendance.section')}>
          <SectionSelect value={sectionId} onChange={(id) => setParam({ sectionId: id })} />
        </Field>
        <Field label={t('attendance.date')}>
          <Input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && setParam({ date: e.target.value })}
          />
        </Field>
      </div>

      {sectionId && (
        <AttendanceGrid key={`${sectionId}.${date}`} sectionId={sectionId} date={date} />
      )}
    </div>
  )
}

// Keyed by section+date, so its draft state starts fresh from this device's saved draft.
function AttendanceGrid({ sectionId, date }: { sectionId: string; date: string }) {
  const { t } = useTranslation()
  const name = useLocalName()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Draft>(
    () => storage.get<Draft>(draftKey(sectionId, date)) ?? {},
  )
  const [focus, setFocus] = useState(0)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])

  const day = useQuery({
    queryKey: ['attendance', sectionId, date],
    queryFn: () => api.get<AttendanceDay>(`/attendance/sections/${sectionId}/days/${date}`),
  })

  useEffect(() => {
    if (Object.keys(storage.get<Draft>(draftKey(sectionId, date)) ?? {}).length) {
      toast.info(t('attendance.draftRestored'))
    }
  }, [sectionId, date, t])

  const rows = useMemo(() => day.data?.rows ?? [], [day.data])
  const statusOf = useCallback(
    (enrollmentId: string, fallback: AttendanceStatus) => draft[enrollmentId]?.status ?? fallback,
    [draft],
  )
  const unsaved = rows.filter(
    (r) => draft[r.enrollmentId] && draft[r.enrollmentId].status !== r.status,
  ).length
  const needsFirstSave = rows.some((r) => !r.marked)
  const counts = attendanceStatuses.map(
    (s) => [s, rows.filter((r) => statusOf(r.enrollmentId, r.status) === s).length] as const,
  )

  const setStatus = useCallback(
    (enrollmentId: string, status: AttendanceStatus) =>
      setDraft((d) => {
        const next = { ...d, [enrollmentId]: { status, id: uuid() } }
        storage.set(draftKey(sectionId, date), next)
        return next
      }),
    [sectionId, date],
  )

  const save = useMutation({
    mutationFn: () => {
      // Send every row so a first save marks the whole day; the server inserts only changes.
      const ids: Draft = {}
      for (const r of rows) {
        ids[r.enrollmentId] = draft[r.enrollmentId] ?? { status: r.status, id: uuid() }
      }
      storage.set(draftKey(sectionId, date), ids)
      return api.post<AttendanceSaveResult>(
        `/attendance/sections/${sectionId}/days/${date}`,
        rows.map((r) => ({ enrollmentId: r.enrollmentId, ...ids[r.enrollmentId] })),
      )
    },
    onSuccess: (res) => {
      storage.remove(draftKey(sectionId, date))
      setDraft({})
      void qc.invalidateQueries({ queryKey: ['attendance', sectionId] })
      if (res.pendingApprovalId) toast.info(t('attendance.sentForApproval'))
      else if (res.inserted === 0) toast.info(t('attendance.nothingChanged'))
      else toast.success(t('attendance.saved'))
    },
  })

  // Ctrl+S anywhere on the page saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        if (rows.length && !save.isPending) save.mutate()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows.length, save])

  function onRowKey(e: React.KeyboardEvent<HTMLDivElement>, index: number) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const row = rows[index]
    const move = (to: number) => {
      const next = Math.max(0, Math.min(rows.length - 1, to))
      setFocus(next)
      rowRefs.current[next]?.focus()
    }
    if (e.key === 'ArrowDown' || e.key === 'Enter') move(index + 1)
    else if (e.key === 'ArrowUp') move(index - 1)
    else if (e.code === 'Space') {
      setStatus(row.enrollmentId, statusOf(row.enrollmentId, row.status) === 'P' ? 'A' : 'P')
    } else if (KEY_TO_STATUS[e.code]) {
      setStatus(row.enrollmentId, KEY_TO_STATUS[e.code])
      move(index + 1)
    } else return
    e.preventDefault()
  }

  return (
    <>
      {day.data?.locked && (
        <p className="rounded-lg border border-warning-border bg-warning-muted p-3 text-sm text-warning-foreground">
          {t('attendance.locked', { days: day.data.lockDays })}
        </p>
      )}
      {day.data && !day.data.locked && needsFirstSave && rows.length > 0 && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {t('attendance.notMarked')}
        </p>
      )}

      {day.isPending && <Loading rows={6} />}
      {day.data && rows.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">{t('attendance.empty')}</p>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            {counts.map(([s, n]) => (
              <span key={s} className="flex items-center gap-1.5">
                <span
                  className={cn('inline-block size-2.5 rounded-full border', STATUS_STYLE[s])}
                />
                {t(`attendance.status.${s}`)}: <strong>{n}</strong>
              </span>
            ))}
            <span className="ms-auto hidden text-muted-foreground md:inline">
              {t('attendance.keys')}
            </span>
          </div>

          <div className="divide-y rounded-lg border" role="grid">
            {rows.map((r, i) => {
              const status = statusOf(r.enrollmentId, r.status)
              const changed = !!draft[r.enrollmentId] && draft[r.enrollmentId].status !== r.status
              return (
                <div
                  key={r.enrollmentId}
                  ref={(el) => {
                    rowRefs.current[i] = el
                  }}
                  role="row"
                  tabIndex={i === focus ? 0 : -1}
                  onFocus={() => setFocus(i)}
                  onKeyDown={(e) => onRowKey(e, i)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 outline-none focus:bg-accent',
                    changed && 'bg-warning-muted/60',
                  )}
                >
                  <span className="w-8 shrink-0 text-sm text-muted-foreground tabular-nums">
                    {r.rollNo ?? ''}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <bdi>{name(r.nameEn, r.nameUr)}</bdi>
                    <span className="ms-2 hidden text-xs text-muted-foreground sm:inline">
                      {r.admissionNo}
                    </span>
                  </span>
                  <div className="flex gap-1" role="radiogroup">
                    {attendanceStatuses.map((s) => (
                      <button
                        key={s}
                        type="button"
                        tabIndex={-1}
                        role="radio"
                        aria-checked={status === s}
                        title={t(`attendance.status.${s}`)}
                        onClick={() => setStatus(r.enrollmentId, s)}
                        className={cn(
                          'rounded-md border font-semibold transition-colors',
                          // Phones get big P/A targets; L/V stay smaller.
                          s === 'P' || s === 'A'
                            ? 'h-11 w-11 text-base md:h-8 md:w-8 md:text-sm'
                            : 'h-11 w-9 text-sm md:h-8 md:w-8',
                          status === s
                            ? STATUS_STYLE[s]
                            : 'bg-background text-muted-foreground hover:bg-accent',
                        )}
                      >
                        {t(`attendance.short.${s}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="fixed inset-x-0 bottom-0 flex items-center gap-3 border-t bg-background p-3 md:static md:border-0 md:bg-transparent md:p-0">
            <Button
              size="lg"
              className="flex-1 md:flex-none"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              <Save />
              {t('attendance.save')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {unsaved > 0 ? t('attendance.unsaved', { count: unsaved }) : t('attendance.saveHint')}
            </span>
          </div>
        </>
      )}
    </>
  )
}
