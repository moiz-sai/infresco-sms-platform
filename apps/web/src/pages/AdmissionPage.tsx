import { admitSchema, type AdmitResult, type GuardianSearchResult } from '@sms/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link2, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { GuardianPicker } from '@/components/GuardianPicker'
import { StudentFieldsForm } from '@/components/StudentFieldsForm'
import { emptyStudent, fromDraft, type StudentDraft } from '@/lib/student-draft'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { api } from '@/lib/api'
import { submitOnCtrlEnter, today, validate, type FieldErrors } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'
import { useClasses, useSections } from '@/lib/setup-queries'

const RELATIONS = ['father', 'mother', 'guardian'] as const

interface GuardianDraft {
  // Set when an existing guardian was picked; the name fields are then ignored.
  existing?: GuardianSearchResult
  searching?: boolean
  nameEn: string
  nameUr: string
  phone: string
  cnic: string
  relation: string
  isPrimary: boolean
}

const newGuardian = (relation: string, isPrimary = false): GuardianDraft => ({
  nameEn: '',
  nameUr: '',
  phone: '',
  cnic: '',
  relation,
  isPrimary,
})

export function AdmissionPage() {
  const { t } = useTranslation()
  const name = useLocalName()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [student, setStudent] = useState<StudentDraft>(emptyStudent)
  const [guardians, setGuardians] = useState<GuardianDraft[]>([newGuardian('father', true)])
  const [classId, setClassId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [rollNo, setRollNo] = useState('')
  const [joinedOn, setJoinedOn] = useState(today())
  const [errors, setErrors] = useState<FieldErrors>({})
  const classes = useClasses()
  const sections = useSections(classId || undefined)

  const admit = useMutation({
    mutationFn: (body: unknown) => api.post<AdmitResult>('/students/admit', body),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['students'] })
      toast.success(t('admission.done', { no: res.admissionNo }))
      void navigate(`/students/${res.studentId}`)
    },
  })

  const setGuardian = (i: number, patch: Partial<GuardianDraft>) =>
    setGuardians((gs) =>
      gs.map((g, j) =>
        j === i ? { ...g, ...patch } : patch.isPrimary ? { ...g, isPrimary: false } : g,
      ),
    )

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = validate(admitSchema, {
      student: fromDraft(student),
      // Untouched guardian rows are dropped instead of failing validation.
      guardians: guardians
        .filter((g) => g.existing || g.nameEn.trim())
        .map((g) =>
          g.existing
            ? { guardianId: g.existing.id, relation: g.relation, isPrimary: g.isPrimary }
            : g,
        ),
      sectionId,
      rollNo: rollNo || null,
      joinedOn,
    })
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    admit.mutate(result.data)
  }

  return (
    <form className="grid max-w-4xl gap-4" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
      <h1 className="text-xl font-semibold">{t('admission.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('admission.student')}</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentFieldsForm
            value={student}
            onChange={setStudent}
            errors={errors}
            errorPrefix="student."
            autoFocus
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admission.guardians')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {guardians.map((g, i) => (
            <div key={i} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
              <Field label={t('admission.relation')}>
                <NativeSelect
                  className="w-full"
                  value={g.relation}
                  onChange={(e) => setGuardian(i, { relation: e.target.value })}
                >
                  {RELATIONS.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {t(`admission.relations.${r}`)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {g.existing ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2 sm:col-span-2">
                  <div className="text-sm">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Link2 className="size-3.5" />
                      {name(g.existing.nameEn, g.existing.nameUr)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('guardianSearch.linked')}
                      {g.existing.children.length > 0 &&
                        ` · ${t('guardianSearch.children', { names: g.existing.children.join(', ') })}`}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setGuardian(i, { existing: undefined })}
                  >
                    {t('guardianSearch.change')}
                  </Button>
                </div>
              ) : g.searching ? (
                <div className="sm:col-span-2">
                  <GuardianPicker
                    onPick={(found) => setGuardian(i, { existing: found, searching: false })}
                  />
                </div>
              ) : (
                <>
                  <Field label={t('student.nameEn')} error={errors[`guardians.${i}.nameEn`]}>
                    <Input
                      value={g.nameEn}
                      onChange={(e) => setGuardian(i, { nameEn: e.target.value })}
                    />
                  </Field>
                  <Field label={t('student.nameUr')}>
                    <Input
                      value={g.nameUr}
                      dir="rtl"
                      lang="ur"
                      className="font-urdu"
                      onChange={(e) => setGuardian(i, { nameUr: e.target.value })}
                    />
                  </Field>
                  <Field label={t('student.phone')}>
                    <Input
                      value={g.phone}
                      inputMode="tel"
                      onChange={(e) => setGuardian(i, { phone: e.target.value })}
                    />
                  </Field>
                  <Field label={t('admission.cnic')}>
                    <Input
                      value={g.cnic}
                      inputMode="numeric"
                      onChange={(e) => setGuardian(i, { cnic: e.target.value })}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-end"
                    onClick={() => setGuardian(i, { searching: true })}
                  >
                    <Link2 />
                    {t('guardianSearch.find')}
                  </Button>
                </>
              )}
              <div className="flex items-end justify-between gap-2">
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <Checkbox
                    checked={g.isPrimary}
                    onCheckedChange={(v) => setGuardian(i, { isPrimary: v === true })}
                  />
                  {t('admission.primary')}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setGuardians((gs) => gs.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                  {t('admission.remove')}
                </Button>
              </div>
            </div>
          ))}
          {guardians.length < 4 && (
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              onClick={() =>
                setGuardians((gs) => [...gs, newGuardian(gs.length === 1 ? 'mother' : 'guardian')])
              }
            >
              <Plus />
              {t('admission.addGuardian')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admission.enrollment')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <Field label={t('students.class')}>
            <NativeSelect
              className="w-full"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value)
                setSectionId('')
              }}
            >
              <NativeSelectOption value="">{t('admission.chooseSection')}</NativeSelectOption>
              {classes.data?.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {name(c.nameEn, c.nameUr)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('students.section')} error={errors.sectionId && t('errors.required')}>
            <NativeSelect
              className="w-full"
              value={sectionId}
              disabled={!classId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {sections.data?.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('students.rollNo')} error={errors.rollNo}>
            <Input value={rollNo} inputMode="numeric" onChange={(e) => setRollNo(e.target.value)} />
          </Field>
          <Field label={t('student.joinedOn')} error={errors.joinedOn}>
            <Input type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={admit.isPending}>
          {t('app.save')}
        </Button>
        <span className="text-sm text-muted-foreground">{t('app.saveHint')}</span>
      </div>
    </form>
  )
}
