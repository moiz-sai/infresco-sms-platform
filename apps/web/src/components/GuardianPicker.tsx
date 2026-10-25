import type { GuardianSearchResult } from '@sms/shared'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useLocalName } from '@/lib/i18n-helpers'

// Search box that lists existing guardians; picking one links the new student to them (SPEC §Z3).
export function GuardianPicker({ onPick }: { onPick: (g: GuardianSearchResult) => void }) {
  const { t } = useTranslation()
  const name = useLocalName()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(id)
  }, [q])
  const results = useQuery({
    queryKey: ['guardians', debounced],
    queryFn: () => api.get<GuardianSearchResult[]>('/guardians', { q: debounced }),
    enabled: debounced.length > 0,
  })

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="ps-8"
          autoFocus
          placeholder={t('guardianSearch.placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {debounced && results.data && (
        <ul className="divide-y rounded-md border text-sm">
          {results.data.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-start hover:bg-accent focus:bg-accent focus:outline-none"
                onClick={() => onPick(g)}
              >
                <div className="font-medium">{name(g.nameEn, g.nameUr)}</div>
                <div className="text-xs text-muted-foreground">
                  {[g.phone, g.cnic].filter(Boolean).join(' · ')}
                  {g.children.length > 0 &&
                    ` · ${t('guardianSearch.children', { names: g.children.join(', ') })}`}
                </div>
              </button>
            </li>
          ))}
          {results.data.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">{t('guardianSearch.none')}</li>
          )}
        </ul>
      )}
    </div>
  )
}
