import { useTranslation } from 'react-i18next'

// Pick the Urdu name in Urdu mode when one exists.
export function useLocalName() {
  const { i18n } = useTranslation()
  return (en: string, ur?: string | null) => (i18n.language === 'ur' && ur ? ur : en)
}
