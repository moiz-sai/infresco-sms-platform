import { amountInWords, formatPaisa, type ApprovalOutcome, type ReceiptView } from '@sms/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Printer } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useCan } from '@/lib/auth'
import { submitOnCtrlEnter } from '@/lib/form'
import { cn } from '@/lib/utils'

export function ReceiptPrintPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const format = params.get('format') === 'a4' ? 'a4' : '80'
  const autoprint = params.get('autoprint') === '1'
  const { t } = useTranslation()
  const receipt = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api.get<ReceiptView>(`/fees/receipts/${id}`),
  })

  const contentRef = useRef<HTMLDivElement>(null)

  // 80 mm rolls get a page exactly as long as the receipt (CSS `size: 80mm auto` is not valid CSS,
  // so browsers ignore it); A4 gets a fixed page. Unnamed @page avoids forced breaks around the content.
  useEffect(() => {
    if (!receipt.data) return
    const style = document.createElement('style')
    const applySize = () => {
      const px = contentRef.current?.getBoundingClientRect().height ?? 0
      const mm = Math.ceil((px * 25.4) / 96) + 4
      style.textContent =
        format === 'a4'
          ? '@page { size: A4 portrait; margin: 10mm; }'
          : `@page { size: 80mm ${mm}mm; margin: 0; }`
    }
    applySize()
    document.head.appendChild(style)
    window.addEventListener('beforeprint', applySize)
    return () => {
      window.removeEventListener('beforeprint', applySize)
      style.remove()
    }
  }, [receipt.data, format])

  useEffect(() => {
    if (!autoprint || !receipt.data) return
    // Wait for the bundled Urdu font, or the first print can show fallback glyphs.
    void document.fonts.ready.then(() => window.print())
  }, [autoprint, receipt.data])

  if (!receipt.data) return <p className="p-4 text-sm text-muted-foreground">{t('app.loading')}</p>
  const r = receipt.data

  return (
    <div className={format === 'a4' ? 'receipt-a4' : 'receipt-80'}>
      <div className="flex gap-2 p-3 print:hidden">
        <Button size="sm" onClick={() => window.print()}>
          <Printer />
          {t('fees.print.printAgain')}
        </Button>
        <CancelReceipt receiptId={r.id} cancelled={r.cancelled} />
      </div>
      <div ref={contentRef}>
        {format === 'a4' ? (
          <div className="mx-auto grid max-w-[190mm] gap-0">
            <ReceiptBody r={r} copy={t('fees.print.officeCopy')} wide />
            <div className="my-[6mm] flex items-center gap-2 text-[8pt] text-neutral-500">
              <span className="flex-1 border-t border-dashed border-neutral-500" />✂{' '}
              {t('fees.print.cut')}
              <span className="flex-1 border-t border-dashed border-neutral-500" />
            </div>
            <ReceiptBody r={r} copy={t('fees.print.parentCopy')} wide />
          </div>
        ) : (
          <ReceiptBody r={r} />
        )}
      </div>
    </div>
  )
}

// Printed receipts always show English and Urdu names side by side, whatever the UI language.
function ReceiptBody({ r, copy, wide }: { r: ReceiptView; copy?: string; wide?: boolean }) {
  const { t } = useTranslation()
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-2">
      <span className="text-neutral-600">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  )
  return (
    <section
      className={cn(
        'relative mx-auto bg-white text-black',
        wide
          ? 'w-full border border-neutral-400 p-[5mm] text-[10pt]'
          : 'w-[72mm] p-[3mm] text-[9pt]',
      )}
    >
      {r.cancelled && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-12 rounded border-4 border-red-600 px-3 text-3xl font-bold text-red-600 opacity-70">
            {t('fees.print.cancelled')}
          </span>
        </div>
      )}
      <header className="mb-2 border-b border-black pb-2 text-center">
        <div className="text-[1.15em] font-bold">{r.school.nameEn}</div>
        {r.school.nameUr && (
          <div dir="rtl" lang="ur" className="font-urdu text-[1.1em]">
            {r.school.nameUr}
          </div>
        )}
        {r.school.address && <div className="text-[0.85em]">{r.school.address}</div>}
        {r.school.phone && <div className="text-[0.85em]">{r.school.phone}</div>}
        <div className="mt-1 font-semibold">
          {t('fees.print.title')}
          {copy && ` — ${copy}`}
        </div>
      </header>

      <div className={cn('grid gap-0.5', wide && 'grid-cols-2 gap-x-8')}>
        {row(t('fees.print.receiptNo'), r.receiptNo)}
        {row(
          t('fees.print.date'),
          new Date(r.createdAt).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
        )}
        {row(
          t('fees.print.student'),
          <>
            {r.student.nameEn}
            {r.student.nameUr && (
              <span dir="rtl" lang="ur" className="ms-1 block font-urdu">
                {r.student.nameUr}
              </span>
            )}
          </>,
        )}
        {row(t('fees.print.admissionNo'), r.student.admissionNo)}
        {row(t('fees.print.class'), `${r.student.classNameEn} — ${r.student.sectionName}`)}
        {r.student.fatherName && row(t('fees.print.father'), r.student.fatherName)}
      </div>

      <table className="my-2 w-full border-collapse">
        <thead>
          <tr className="border-y border-black">
            <th className="py-0.5 text-start font-semibold">{t('fees.period')}</th>
            <th className="py-0.5 text-start font-semibold">{t('fees.head')}</th>
            <th className="py-0.5 text-end font-semibold">{t('fees.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l, i) => (
            <tr key={i}>
              <td className="py-0.5">{l.period}</td>
              <td className="py-0.5">
                {l.headNameEn}
                {l.headNameUr && (
                  <>
                    {' '}
                    <bdi lang="ur" className="font-urdu">
                      ({l.headNameUr})
                    </bdi>
                  </>
                )}
              </td>
              <td className="py-0.5 text-end tabular-nums">{formatPaisa(l.amountPaisa)}</td>
            </tr>
          ))}
          <tr className="border-t border-black font-bold">
            <td className="py-1" colSpan={2}>
              {t('fees.print.totalPaid')}
            </td>
            <td className="py-1 text-end tabular-nums">{formatPaisa(r.totalPaisa)}</td>
          </tr>
        </tbody>
      </table>

      <div className="grid gap-0.5">
        <div className="text-[0.9em]">
          <span className="text-neutral-600">{t('fees.print.inWords')}: </span>
          <em>{amountInWords(r.totalPaisa)}</em>
        </div>
        {row(t('fees.print.method'), t(`fees.methods.${r.method}`))}
        {row(t('fees.print.balanceAfter'), formatPaisa(r.balanceAfterPaisa))}
        {row(t('fees.print.receivedBy'), r.receivedBy)}
      </div>
    </section>
  )
}

function CancelReceipt({ receiptId, cancelled }: { receiptId: string; cancelled: boolean }) {
  const { t } = useTranslation()
  const can = useCan()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const reverse = useMutation({
    mutationFn: () => api.post<ApprovalOutcome>(`/fees/receipts/${receiptId}/reverse`, { reason }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['receipt', receiptId] })
      void qc.invalidateQueries({ queryKey: ['statement'] })
      toast[res.applied ? 'success' : 'info'](t(res.applied ? 'reverse.applied' : 'reverse.sent'))
      setOpen(false)
    },
  })
  if (cancelled || !can('fees.reverse.request')) return null
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (reason.trim()) reverse.mutate()
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Ban />
        {t('reverse.button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('reverse.title')}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={onSubmit} onKeyDown={submitOnCtrlEnter}>
            <Field label={t('reverse.reason')}>
              <Input value={reason} autoFocus onChange={(e) => setReason(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                disabled={reverse.isPending || !reason.trim()}
              >
                {t('reverse.button')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
