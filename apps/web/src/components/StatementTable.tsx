import { formatPaisa, type StatementEntry } from '@sms/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLocalName } from '@/lib/i18n-helpers'
import { cn } from '@/lib/utils'

export function StatementTable({ entries }: { entries: StatementEntry[] }) {
  const { t } = useTranslation()
  const name = useLocalName()
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">{t('fees.date')}</TableHead>
            <TableHead className="text-start">{t('fees.period')}</TableHead>
            <TableHead className="text-start">{t('fees.head')}</TableHead>
            <TableHead className="text-start">{t('fees.type')}</TableHead>
            <TableHead className="text-end">{t('fees.amount')}</TableHead>
            <TableHead className="text-end">{t('fees.balance')}</TableHead>
            <TableHead className="text-start">{t('fees.receipt')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap">{e.createdAt.slice(0, 10)}</TableCell>
              <TableCell>{e.period}</TableCell>
              <TableCell>{name(e.headNameEn, e.headNameUr)}</TableCell>
              <TableCell>{t(`fees.types.${e.type}`)}</TableCell>
              <TableCell
                className={cn('text-end tabular-nums', e.amountPaisa < 0 && 'text-emerald-700')}
              >
                {formatPaisa(e.amountPaisa)}
              </TableCell>
              <TableCell className="text-end font-medium tabular-nums">
                {formatPaisa(e.balancePaisa)}
              </TableCell>
              <TableCell>
                {e.receiptId && (
                  <Link
                    className="text-primary underline-offset-2 hover:underline"
                    to={`/print/receipt/${e.receiptId}`}
                    target="_blank"
                  >
                    {e.receiptNo}
                  </Link>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
