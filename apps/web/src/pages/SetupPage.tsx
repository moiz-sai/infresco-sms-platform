import { classSchema, yearSchema, type Year } from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loading } from '@/components/Loading'
import { Field } from '@/components/Field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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
import { useBranding } from '@/lib/branding'
import { submitOnCtrlEnter, validate, type FieldErrors } from '@/lib/form'
import { useLocalName } from '@/lib/i18n-helpers'
import { useClasses, useSections } from '@/lib/setup-queries'

export function SetupPage() {
  const { t } = useTranslation()
  return (
    <div className="grid max-w-4xl gap-4">
      <h1 className="text-xl font-semibold">{t('nav.setup')}</h1>
      <Tabs defaultValue="school">
        <TabsList>
          <TabsTrigger value="school">{t('setup.school')}</TabsTrigger>
          <TabsTrigger value="years">{t('setup.years')}</TabsTrigger>
          <TabsTrigger value="classes">{t('setup.classes')}</TabsTrigger>
        </TabsList>
        <TabsContent value="school" className="pt-2">
          <SchoolForm />
        </TabsContent>
        <TabsContent value="years" className="pt-2">
          <Years />
        </TabsContent>
        <TabsContent value="classes" className="pt-2">
          <Classes />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Invalidate everything setup-related after any change; the lists are tiny.
function useSetupMutation<T>(fn: (body: T) => Promise<unknown>, message = 'app.saved') {
  const { t } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ['school', 'years', 'classes', 'sections']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
      toast.success(t(message))
    },
  })
}

function SchoolForm() {
  const { t } = useTranslation()
  const name = useLocalName()
  const { data } = useBranding()
  if (!data) return <Loading rows={4} />
  const row = (label: string, value: string | null) => (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value || t('app.none')}</span>
    </div>
  )
  // Name, logo, address and phone are set by Infresco from the developer profile (§T13),
  // so the school sees them here but cannot change them.
  return (
    <Card>
      <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
        <p className="text-sm text-muted-foreground sm:col-span-2">
          {t('setup.brandingNote')}
        </p>
        {row(t('setup.nameEn'), name(data.nameEn, data.nameUr))}
        {row(t('setup.address'), data.address)}
        {row(t('setup.phone'), data.phone)}
      </CardContent>
    </Card>
  )
}

function Years() {
  const { t } = useTranslation()
  const years = useQuery({ queryKey: ['years'], queryFn: () => api.get<Year[]>('/years') })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isCurrent, setIsCurrent] = useState(false)
  const create = useSetupMutation((body: unknown) => api.post('/years', body))
  const update = useSetupMutation(({ id, ...body }: Year) => api.put(`/years/${id}`, body))
  const remove = useSetupMutation((id: string) => api.del(`/years/${id}`), 'app.deleted')

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const result = validate(yearSchema, { ...Object.fromEntries(new FormData(form)), isCurrent })
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    create.mutate(result.data, { onSuccess: () => form.reset() })
  }

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t('setup.label')}</TableHead>
              <TableHead className="text-start">{t('setup.startsOn')}</TableHead>
              <TableHead className="text-start">{t('setup.endsOn')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.data?.map((y) => (
              <TableRow key={y.id}>
                <TableCell className="font-medium">{y.label}</TableCell>
                <TableCell>{y.startsOn}</TableCell>
                <TableCell>{y.endsOn}</TableCell>
                <TableCell className="text-end">
                  {y.isCurrent ? (
                    <Badge>{t('setup.current')}</Badge>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => update.mutate({ ...y, isCurrent: true })}
                      >
                        {t('setup.makeCurrent')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('app.delete')}
                        onClick={() => confirm(t('app.confirmDelete')) && remove.mutate(y.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('app.add')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-4"
            onSubmit={onSubmit}
            onKeyDown={submitOnCtrlEnter}
          >
            <Field label={t('setup.label')} error={errors.label}>
              <Input name="label" placeholder="2027-28" />
            </Field>
            <Field label={t('setup.startsOn')} error={errors.startsOn}>
              <Input name="startsOn" type="date" />
            </Field>
            <Field label={t('setup.endsOn')} error={errors.endsOn}>
              <Input name="endsOn" type="date" />
            </Field>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox checked={isCurrent} onCheckedChange={(v) => setIsCurrent(v === true)} />
                {t('setup.current')}
              </label>
              <Button type="submit" disabled={create.isPending}>
                <Plus />
                {t('app.add')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function Classes() {
  const { t } = useTranslation()
  const name = useLocalName()
  const classes = useClasses()
  const sections = useSections()
  const years = useQuery({ queryKey: ['years'], queryFn: () => api.get<Year[]>('/years') })
  const currentYear = years.data?.find((y) => y.isCurrent)
  const [errors, setErrors] = useState<FieldErrors>({})
  const createClass = useSetupMutation((body: unknown) => api.post('/classes', body))
  const removeClass = useSetupMutation((id: string) => api.del(`/classes/${id}`), 'app.deleted')
  const createSection = useSetupMutation((body: unknown) => api.post('/sections', body))
  const removeSection = useSetupMutation((id: string) => api.del(`/sections/${id}`), 'app.deleted')

  function onAddClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const result = validate(classSchema, Object.fromEntries(new FormData(form)))
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    createClass.mutate(result.data, { onSuccess: () => form.reset() })
  }

  function onAddSection(e: FormEvent<HTMLFormElement>, classId: string) {
    e.preventDefault()
    const form = e.currentTarget
    const sectionName = String(new FormData(form).get('name') ?? '').trim()
    if (!sectionName || !currentYear) return
    createSection.mutate(
      { classId, yearId: currentYear.id, name: sectionName },
      { onSuccess: () => form.reset() },
    )
  }

  return (
    <div className="grid gap-4">
      {!currentYear && years.data && (
        <p className="rounded-lg border border-dashed p-4 text-muted-foreground">
          {t('setup.noYear')}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-start">{t('setup.level')}</TableHead>
              <TableHead className="text-start">{t('students.class')}</TableHead>
              <TableHead className="text-start">
                {t('setup.sections')} {currentYear && `(${currentYear.label})`}
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.level}</TableCell>
                <TableCell className="font-medium">{name(c.nameEn, c.nameUr)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {sections.data
                      ?.filter((s) => s.classId === c.id)
                      .map((s) => (
                        <Badge key={s.id} variant="secondary" className="gap-1">
                          {s.name}
                          <button
                            type="button"
                            aria-label={t('app.delete')}
                            onClick={() =>
                              confirm(t('app.confirmDelete')) && removeSection.mutate(s.id)
                            }
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    {currentYear && (
                      <form className="flex gap-1" onSubmit={(e) => onAddSection(e, c.id)}>
                        <Input
                          name="name"
                          className="h-7 w-24"
                          placeholder={t('setup.sectionName')}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          aria-label={t('setup.addSection')}
                        >
                          <Plus />
                        </Button>
                      </form>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('app.delete')}
                    onClick={() => confirm(t('app.confirmDelete')) && removeClass.mutate(c.id)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('app.add')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-4"
            onSubmit={onAddClass}
            onKeyDown={submitOnCtrlEnter}
          >
            <Field label={t('setup.nameEn')} error={errors.nameEn}>
              <Input name="nameEn" placeholder={t('setup.classExample')} />
            </Field>
            <Field label={t('setup.nameUr')} error={errors.nameUr}>
              <Input name="nameUr" dir="rtl" lang="ur" className="font-urdu" />
            </Field>
            <Field label={t('setup.level')} error={errors.level}>
              <Input name="level" inputMode="numeric" />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={createClass.isPending}>
                <Plus />
                {t('app.add')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
