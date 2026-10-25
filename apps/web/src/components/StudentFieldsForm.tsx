import { useTranslation } from 'react-i18next'
import { Field } from '@/components/Field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type { FieldErrors } from '@/lib/form'
import type { StudentDraft } from '@/lib/student-draft'

export function StudentFieldsForm({
  value,
  onChange,
  errors,
  errorPrefix = '',
  autoFocus,
}: {
  value: StudentDraft
  onChange: (v: StudentDraft) => void
  errors: FieldErrors
  errorPrefix?: string
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const set = (k: keyof StudentDraft) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value })
  const err = (k: string) => errors[errorPrefix + k]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('student.nameEn')} error={err('nameEn')}>
        <Input value={value.nameEn} onChange={set('nameEn')} autoFocus={autoFocus} />
      </Field>
      <Field label={t('student.nameUr')} error={err('nameUr')}>
        <Input
          value={value.nameUr}
          onChange={set('nameUr')}
          dir="rtl"
          lang="ur"
          className="font-urdu"
        />
      </Field>
      <Field label={t('student.fatherName')} error={err('fatherName')}>
        <Input value={value.fatherName} onChange={set('fatherName')} />
      </Field>
      <Field label={t('student.gender')} error={err('gender')}>
        <NativeSelect className="w-full" value={value.gender} onChange={set('gender')}>
          <NativeSelectOption value="m">{t('student.m')}</NativeSelectOption>
          <NativeSelectOption value="f">{t('student.f')}</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label={t('student.dob')} error={err('dob')}>
        <Input type="date" value={value.dob} onChange={set('dob')} />
      </Field>
      <Field label={t('student.bForm')} error={err('bForm')}>
        <Input value={value.bForm} onChange={set('bForm')} inputMode="numeric" />
      </Field>
      <Field label={t('student.phone')} error={err('phone')}>
        <Input value={value.phone} onChange={set('phone')} inputMode="tel" />
      </Field>
      <Field label={t('student.address')} error={err('address')} className="sm:col-span-2">
        <Textarea value={value.address} onChange={set('address')} rows={2} />
      </Field>
    </div>
  )
}
