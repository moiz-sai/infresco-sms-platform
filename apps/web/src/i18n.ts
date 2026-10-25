import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ur from './locales/ur.json'

const STORAGE_KEY = 'sms.lang'

function storedLanguage(): 'en' | 'ur' {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ur' ? 'ur' : 'en'
  } catch {
    return 'en'
  }
}

function applyToDocument(lng: string) {
  document.documentElement.lang = lng
  document.documentElement.dir = lng === 'ur' ? 'rtl' : 'ltr'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ur: { translation: ur } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})
applyToDocument(i18n.language)

i18n.on('languageChanged', (lng) => {
  applyToDocument(lng)
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // private mode: language just won't persist
  }
})

export default i18n
