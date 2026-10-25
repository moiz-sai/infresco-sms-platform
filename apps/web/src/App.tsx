import { QueryClientProvider } from '@tanstack/react-query'
import { Direction } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/lib/query'
import { router } from './router'

// Radix needs the direction too, so menus/tabs flip their keyboard handling in Urdu.
export function App() {
  const { i18n } = useTranslation()
  const dir = i18n.language === 'ur' ? 'rtl' : 'ltr'
  return (
    <Direction.Provider dir={dir}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors dir={dir} />
      </QueryClientProvider>
    </Direction.Provider>
  )
}
