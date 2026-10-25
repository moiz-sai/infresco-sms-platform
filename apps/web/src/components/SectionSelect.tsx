import { useTranslation } from 'react-i18next'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useLocalName } from '@/lib/i18n-helpers'
import { useSections } from '@/lib/setup-queries'

export function SectionSelect({
  value,
  onChange,
  yearId,
}: {
  value: string
  onChange: (sectionId: string) => void
  yearId?: string
}) {
  const { t } = useTranslation()
  const name = useLocalName()
  const sections = useSections(undefined, yearId)
  return (
    <NativeSelect className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
      <NativeSelectOption value="">{t('attendance.chooseSection')}</NativeSelectOption>
      {sections.data?.map((s) => (
        <NativeSelectOption key={s.id} value={s.id}>
          {name(s.classNameEn, s.classNameUr)} — {s.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
