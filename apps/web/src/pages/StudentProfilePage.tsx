import {
  formatPaisa,
  leaveSchema,
  studentFieldsSchema,
  type AttendanceSummary,
  type Statement,
  type StudentDetail,
} from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Pencil, Percent, UserMinus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { DiscountDialog } from '@/components/DiscountDialog'
import { Field } from '@/components/Field'
import { StatementTable } from '@/components/StatementTable'
import { StudentFieldsForm } from '@/components/StudentFieldsForm'
import { fromDraft, toDraft, type StudentDraft } from '@/lib/student-draft'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useCan } from '@/lib/auth'
import { submitOnCtrlEnter, today, validate, type FieldErrors } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'

export function StudentProfilePage() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const name = useLocalName()
  const can = useCan()
  const [editing, setEditing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const student = useQuery({
    queryKey: ['student', id],
    queryFn: () => api.get<StudentDetail>(`/students/${id}`),
  })

  if (student.isPending) return <Skeleton className="h-64 w-full max-w-4xl" />
  if (!student.data) return <p className="text-muted-foreground">{t('app.notFound')}</p>
  const s = student.data
  const current = s.enrollments.find((e) => e.status === 'active') ?? s.enrollments[0]

  const detail = (label: string, value: string | null | undefined) => (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value || t('app.none')}</span>
    </div>
  )

  return (
    <div className="grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="me-auto grid gap-1">
          <h1 className="flex flex-wrap items-baseline gap-x-3 text-xl font-semibold">
            <span>{s.nameEn}</span>
            {s.nameUr && (
              <span dir="rtl" lang="ur" className="font-urdu">
                {s.nameUr}
              </span>
            )}
          </h1>
          {current && (
            <p className="text-sm text-muted-foreground">
              {current.admissionNo} · {name(current.classNameEn, current.classNameUr)} —{' '}
              {current.sectionName}
              {current.rollNo ? ` · ${t('students.rollNo')} ${current.rollNo}` : ''}
            </p>
          )}
        </div>
        <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>
          {t(`students.status.${s.status}`)}
        </Badge>
        {can('students.edit') && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            {t('app.edit')}
          </Button>
        )}
        {can('students.edit') && s.status === 'active' && (
          <Button variant="outline" size="sm" onClick={() => setLeaving(true)}>
            <UserMinus />
            {t('student.leave')}
          </Button>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t('student.details')}</TabsTrigger>
          <TabsTrigger value="guardians">{t('student.guardians')}</TabsTrigger>
          <TabsTrigger value="history">{t('student.history')}</TabsTrigger>
          <TabsTrigger value="attendance">{t('student.attendance')}</TabsTrigger>
          <TabsTrigger value="fees">{t('student.fees')}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-2">
          {editing ? (
            <EditStudent student={s} onDone={() => setEditing(false)} />
          ) : (
            <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
              {detail(t('student.fatherName'), s.fatherName)}
              {detail(t('student.gender'), t(`student.${s.gender}`))}
              {detail(t('student.dob'), s.dob)}
              {detail(t('student.bForm'), s.bForm)}
              {detail(t('student.phone'), s.phone)}
              {detail(t('student.address'), s.address)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="guardians" className="pt-2">
          {s.guardians.length === 0 ? (
            <p className="text-muted-foreground">{t('student.noGuardians')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {s.guardians.map((g) => (
                <div key={g.id} className="grid gap-1 rounded-lg border p-4">
                  <div className="flex items-center gap-2 font-medium">
                    {name(g.nameEn, g.nameUr)}
                    {g.isPrimary && <Badge variant="secondary">{t('admission.primary')}</Badge>}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {t(`admission.relations.${g.relation}`, { defaultValue: g.relation })}
                  </span>
                  <span className="text-sm">{g.phone ?? t('app.none')}</span>
                  {g.cnic && <span className="text-sm">{g.cnic}</span>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="pt-2">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('student.year')}</TableHead>
                  <TableHead className="text-start">{t('students.class')}</TableHead>
                  <TableHead className="text-start">{t('students.admissionNo')}</TableHead>
                  <TableHead className="text-start">{t('student.joinedOn')}</TableHead>
                  <TableHead className="text-start">{t('student.leftOn')}</TableHead>
                  <TableHead className="text-start">{t('student.statusCol')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.enrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.yearLabel}</TableCell>
                    <TableCell>
                      {name(e.classNameEn, e.classNameUr)} — {e.sectionName}
                    </TableCell>
                    <TableCell>{e.admissionNo}</TableCell>
                    <TableCell>{e.joinedOn}</TableCell>
                    <TableCell>{e.leftOn ?? t('app.none')}</TableCell>
                    <TableCell>{t(`students.status.${e.status}`)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="pt-2">
          {current && can('attendance.view') ? (
            <AttendanceTab enrollmentId={current.id} />
          ) : (
            <p className="text-muted-foreground">{t('app.none')}</p>
          )}
        </TabsContent>
        <TabsContent value="fees" className="pt-2">
          {current && can('fees.collect') ? (
            <FeesTab enrollmentId={current.id} />
          ) : (
            <p className="text-muted-foreground">{t('app.none')}</p>
          )}
        </TabsContent>
      </Tabs>

      <LeaveDialog studentId={s.id} open={leaving} onOpenChange={setLeaving} />
    </div>
  )
}

function EditStudent({ student, onDone }: { student: StudentDetail; onDone: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<StudentDraft>(toDraft(student))
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({
    mutationFn: (body: unknown) => api.put(`/students/${student.id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student', student.id] })
      void qc.invalidateQueries({ queryKey: ['students'] })
      toast.success(t('app.saved'))
      onDone()
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = validate(studentFieldsSchema, fromDraft(draft))
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    save.mutate(result.data)
  }

  return (
    <form
      className="grid gap-4 rounded-lg border p-4"
      onSubmit={onSubmit}
      onKeyDown={submitOnCtrlEnter}
    >
      <StudentFieldsForm value={draft} onChange={setDraft} errors={errors} autoFocus />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t('app.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('app.cancel')}
        </Button>
        <span className="text-sm text-muted-foreground">{t('app.saveHint')}</span>
      </div>
    </form>
  )
}

function LeaveDialog({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [leftOn, setLeftOn] = useState(today())
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const leave = useMutation({
    mutationFn: (body: unknown) => api.post(`/students/${studentId}/leave`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['student', studentId] })
      void qc.invalidateQueries({ queryKey: ['students'] })
      toast.success(t('student.leftDone'))
      onOpenChange(false)
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = validate(leaveSchema, { leftOn, reason })
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    leave.mutate(result.data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('student.leave')}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
          <Field label={t('student.leftOn')} error={errors.leftOn}>
            <Input type="date" value={leftOn} onChange={(e) => setLeftOn(e.target.value)} />
          </Field>
          <Field label={t('student.reason')} error={errors.reason}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={leave.isPending}>
              {t('student.leave')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FeesTab({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation()
  const can = useCan()
  const [discounting, setDiscounting] = useState(false)
  const statement = useQuery({
    queryKey: ['statement', enrollmentId],
    queryFn: () => api.get<Statement>(`/fees/students/${enrollmentId}/statement`),
  })
  if (!statement.data) return <Skeleton className="h-32 w-full" />
  const s = statement.data
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">{t('fees.total')}</span>
        <span className="text-lg font-semibold tabular-nums">
          {formatPaisa(Math.max(0, s.balancePaisa))}
        </span>
        {s.advancePaisa > 0 && (
          <span className="text-sm text-emerald-700">
            {t('fees.advance')}: {formatPaisa(s.advancePaisa)}
          </span>
        )}
        {can('fees.discount') && s.dues.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="ms-auto"
            onClick={() => setDiscounting(true)}
          >
            <Percent />
            {t('discount.button')}
          </Button>
        )}
        <Button
          size="sm"
          className={s.dues.length > 0 && can('fees.discount') ? '' : 'ms-auto'}
          asChild
        >
          <Link to={`/fees/collect?enrollmentId=${enrollmentId}`}>
            <Banknote />
            {t('fees.collectFee')}
          </Link>
        </Button>
      </div>
      <DiscountDialog
        enrollmentId={enrollmentId}
        dues={s.dues}
        open={discounting}
        onOpenChange={setDiscounting}
      />
      {s.entries.length > 0 ? (
        <StatementTable entries={s.entries} />
      ) : (
        <p className="text-muted-foreground">{t('fees.noDues')}</p>
      )}
    </div>
  )
}

// SPEC §Z4: year-to-date attendance % with P/A/L/V counts and a per-month list.
function AttendanceTab({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation()
  const summary = useQuery({
    queryKey: ['attendance', 'summary', enrollmentId],
    queryFn: () => api.get<AttendanceSummary>(`/attendance/enrollments/${enrollmentId}/summary`),
  })
  if (!summary.data) return <Skeleton className="h-32 w-full" />
  const s = summary.data
  const pct = (v: number | null) => (v === null ? t('app.none') : `${v}%`)
  const statuses = ['P', 'A', 'L', 'V'] as const
  if (s.months.length === 0) {
    return <p className="text-muted-foreground">{t('student.noAttendance')}</p>
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span className="text-2xl font-semibold tabular-nums">{pct(s.pct)}</span>
        {statuses.map((st) => (
          <span key={st} className="text-sm">
            <span className="text-muted-foreground">{t(`attendance.status.${st}`)}: </span>
            <span className="font-medium tabular-nums">{s.counts[st]}</span>
          </span>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('student.month')}</TableHead>
            {statuses.map((st) => (
              <TableHead key={st} className="text-end">
                {t(`attendance.short.${st}`)}
              </TableHead>
            ))}
            <TableHead className="text-end">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {s.months.map((m) => (
            <TableRow key={m.month}>
              <TableCell>{m.month}</TableCell>
              {statuses.map((st) => (
                <TableCell key={st} className="text-end tabular-nums">
                  {m.counts[st]}
                </TableCell>
              ))}
              <TableCell className="text-end font-medium tabular-nums">{pct(m.pct)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
