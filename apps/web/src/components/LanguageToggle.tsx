import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void i18n.changeLanguage(i18n.language === 'ur' ? 'en' : 'ur')}
    >
      <Languages />
      {t('app.language')}
    </Button>
  )
}
