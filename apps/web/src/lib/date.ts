import { useTranslation } from 'react-i18next'

// Dates and times in the UI language (Urdu month names in Urdu mode), digits stay Latin.
export function useFormatDate() {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB'
  return (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleString(locale, opts)
}
