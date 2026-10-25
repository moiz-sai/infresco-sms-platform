import type { ClassRate, Dashboard } from '@sms/shared'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useLocalName } from '@/lib/i18n-helpers'

const BAR = 'var(--info)'
const LINE = 'var(--success)'

// Loaded with React.lazy so recharts stays out of the main bundle (SPEC §T8).
// SVG text breaks under dir=rtl, so charts render LTR and mirror via reversed axes in Urdu.
export default function DashboardCharts({ data }: { data: Dashboard }) {
  const { t, i18n } = useTranslation()
  const rtl = i18n.dir() === 'rtl'
  return (
    <>
      <ChartCard title={t('dashboard.collectionByClass')}>
        <ClassBars rates={data.collectionByClass} rtl={rtl} />
      </ChartCard>
      <ChartCard title={t('dashboard.attendanceByClass')}>
        <ClassBars rates={data.attendanceByClass} rtl={rtl} />
      </ChartCard>
      <ChartCard title={t('dashboard.attendanceTrend')} wide>
        {data.attendanceTrend.length === 0 ? (
          <Empty />
        ) : (
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={data.attendanceTrend}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8)} reversed={rtl} />
                <YAxis domain={[0, 100]} width={48} orientation={rtl ? 'right' : 'left'} unit="%" />
                <Tooltip formatter={(v) => [`${String(v)}%`, t('dashboard.present')]} />
                <Line type="monotone" dataKey="pct" stroke={LINE} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </>
  )
}

function ClassBars({ rates, rtl }: { rates: ClassRate[]; rtl: boolean }) {
  const name = useLocalName()
  const rows = rates.map((r) => ({ label: name(r.classNameEn, r.classNameUr), pct: r.pct ?? 0 }))
  if (rates.every((r) => r.pct === null)) return <Empty />
  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" reversed={rtl} interval={0} fontSize={12} />
          <YAxis domain={[0, 100]} width={48} orientation={rtl ? 'right' : 'left'} unit="%" />
          <Tooltip formatter={(v) => `${String(v)}%`} />
          <Bar dataKey="pct" fill={BAR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChartCard({
  title,
  wide,
  children,
}: {
  title: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={`grid gap-2 rounded-lg border p-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  )
}

function Empty() {
  const { t } = useTranslation()
  return <p className="py-16 text-center text-sm text-muted-foreground">{t('dashboard.noData')}</p>
}
