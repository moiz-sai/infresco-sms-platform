import { useTranslation } from 'react-i18next'
import { logoUrl, useBranding } from '@/lib/branding'
import { useLocalName } from '@/lib/i18n-helpers'
import { cn } from '@/lib/utils'

// Logo + school name, used in the sidebar, the login card and print letterheads.
export function BrandMark({
  className,
  logoClassName = 'h-8',
  showName = true,
}: {
  className?: string
  logoClassName?: string
  showName?: boolean
}) {
  const name = useLocalName()
  const { t } = useTranslation()
  const { data } = useBranding()
  const src = logoUrl(data)
  const label = data ? name(data.nameEn, data.nameUr) : t('app.name')
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {src && <img src={src} alt="" className={cn('w-auto object-contain', logoClassName)} />}
      {showName && <span className="font-semibold leading-tight">{label}</span>}
    </div>
  )
}

// Footer on every screen (set from the developer profile).
export function AppFooter() {
  const name = useLocalName()
  const { data } = useBranding()
  const footer = data && name(data.footerEn ?? '', data.footerUr ?? '')
  if (!footer) return null
  return (
    <footer className="border-t px-4 py-2 text-center text-xs text-muted-foreground print:hidden">
      {footer}
    </footer>
  )
}

// Letterhead for print pages: centred logo, name, address/phone.
export function PrintLetterhead({ compact = false }: { compact?: boolean }) {
  const name = useLocalName()
  const { data } = useBranding()
  const src = logoUrl(data)
  if (!data) return null
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      {src && (
        <img src={src} alt="" className={cn('w-auto object-contain', compact ? 'h-8' : 'h-12')} />
      )}
      <div className={cn('font-bold', compact ? 'text-[1.15em]' : 'text-lg')}>
        {name(data.nameEn, data.nameUr)}
      </div>
      {!compact && (data.address || data.phone) && (
        <div className="text-[0.85em] text-neutral-600">
          {[data.address, data.phone].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  )
}

// Footer line printed at the bottom of a page.
export function PrintFooter() {
  const name = useLocalName()
  const { data } = useBranding()
  const footer = data && name(data.footerEn ?? '', data.footerUr ?? '')
  if (!footer) return null
  return <div className="mt-2 text-center text-[0.8em] text-neutral-500">{footer}</div>
}
