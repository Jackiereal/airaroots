'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  Legend,
} from 'recharts';

type DashData = {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  netCashFlow: number;
  adr: number;
  revpar: number;
  occupancyPct: number;
  avgLengthOfStay: number;
  avgBookingValue: number;
  totalNightsBooked: number;
  bookingCount: number;
  annualRevenue: number;
  annualProfit: number;
  totalOutstandingLoans: number;
  totalMonthlyEmi: number;
  revBySource: Record<string, number>;
  expByCategory: Record<string, number>;
  loans: { id: string; name: string; emi: number; outstanding: number; debtFreeDate: string }[];
};

function fmt(n: number) {
  return '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function pct(n: number) {
  return n.toFixed(1) + '%';
}

const KPI_TONE_SHELL = {
  neutral: 'border-[var(--border-color)] bg-[var(--bg-surface)]',
  income: 'border-[var(--accent)]/50 bg-[var(--accent)]/[0.11]',
  profit: 'border-teal-500/45 bg-teal-950/35',
  sky: 'border-sky-500/45 bg-sky-950/30',
  amber: 'border-amber-500/45 bg-amber-950/30',
  rose: 'border-rose-500/45 bg-rose-950/30',
  violet: 'border-violet-500/45 bg-violet-950/30',
} as const;

const KPI_TONE_VALUE = {
  neutral: 'text-[var(--text-primary)]',
  income: 'text-[var(--accent)]',
  profit: 'text-teal-200',
  sky: 'text-sky-200',
  amber: 'text-amber-200',
  rose: 'text-rose-200',
  violet: 'text-violet-200',
} as const;

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof KPI_TONE_SHELL;
}) {
  return (
    <div className={['rounded-xl border p-3 sm:p-4', KPI_TONE_SHELL[tone]].join(' ')}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
      <p className={['text-xl font-bold mt-1 tabular-nums', KPI_TONE_VALUE[tone]].join(' ')}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function FinanceDashboard({ month, propertyId }: { month: string; propertyId: string }) {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<{ month: string; netCash: number; expenses: number; airbnbBank: number; direct: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/finance/${propertyId}/summary?month=${month}&trendMonths=9`)
      .then((r) => r.json())
      .then((summary) => {
        if (summary?.error) { setError(summary.error as string); return; }
        const agg = summary?.aggregates ?? {};
        setData({
          month,
          revenue: agg.cashInboundEstimate ?? 0,
          expenses: agg.expenseTotal ?? 0,
          profit: agg.netCash ?? 0,
          netCashFlow: agg.netCash ?? 0,
          adr: agg.averageGuestChargePerNight ?? 0,
          revpar: 0,
          occupancyPct: 0,
          avgLengthOfStay: agg.daysBooked && agg.totalBookingCount ? agg.daysBooked / agg.totalBookingCount : 0,
          avgBookingValue: agg.totalBookingCount ? agg.cashInboundEstimate / agg.totalBookingCount : 0,
          totalNightsBooked: agg.daysBooked ?? 0,
          bookingCount: agg.totalBookingCount ?? 0,
          annualRevenue: 0,
          annualProfit: 0,
          totalOutstandingLoans: 0,
          totalMonthlyEmi: 0,
          revBySource: { Airbnb: agg.bankPayouts ?? 0, Direct: agg.directTotal ?? 0 },
          expByCategory: agg.expenseByCategory ?? {},
          loans: [],
        });
        setTrend(summary?.trend ?? []);
      })
      .finally(() => setLoading(false));
  }, [month, propertyId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard...
      </div>
    );
  }

  if (error) return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-300">
      Dashboard error: {error}
    </div>
  );

  if (!data) return null;

  const revVsExpChart = trend.map((t) => ({
    month: t.month,
    Revenue: Math.round((t.netCash + t.expenses) * 100) / 100,
    Expenses: t.expenses,
  }));

  const occupancyChart = trend.map((t) => ({
    month: t.month,
    ADR: t.netCash + t.expenses > 0 ? Math.round(((t.netCash + t.expenses) / 30) * 100) / 100 : 0,
    'Net Cash': t.netCash,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-3">Hospitality Metrics</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <KpiCard label="ADR" value={fmt(data.adr)} sub="Avg Daily Rate" tone="income" />
          <KpiCard label="RevPAR" value={fmt(data.revpar)} sub="Revenue per Available Night" tone="sky" />
          <KpiCard label="Occupancy" value={pct(data.occupancyPct)} sub={`${data.totalNightsBooked} nights booked`} tone="profit" />
          <KpiCard label="Avg Stay" value={`${data.avgLengthOfStay.toFixed(1)} nights`} sub={`${data.bookingCount} bookings`} tone="neutral" />
          <KpiCard label="Avg Booking Value" value={fmt(data.avgBookingValue)} tone="violet" />
          <KpiCard label="Annual Revenue" value={fmt(data.annualRevenue)} sub="Current year" tone="income" />
          <KpiCard label="Annual Profit" value={fmt(data.annualProfit)} sub="Current year" tone="profit" />
          <KpiCard label="Net Cash Flow" value={fmt(data.netCashFlow)} sub="Revenue − Expenses − EMIs" tone={data.netCashFlow >= 0 ? 'profit' : 'rose'} />
        </div>
      </div>

      {data.loans.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-3">Loan Snapshot</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard label="Outstanding Loans" value={fmt(data.totalOutstandingLoans)} tone="rose" />
            <KpiCard label="Monthly EMIs" value={fmt(data.totalMonthlyEmi)} tone="amber" />
            {data.loans.map((l) => (
              <KpiCard
                key={l.id}
                label={l.name}
                value={fmt(l.outstanding)}
                sub={`EMI ${fmt(l.emi)} · Free ${new Date(l.debtFreeDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
                tone="amber"
              />
            ))}
          </div>
        </div>
      )}

      {revVsExpChart.length > 1 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Revenue vs Expenses</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revVsExpChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }}
                  formatter={(v) => fmt(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expenses" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Net Cash Flow Trend</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={occupancyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }}
                  formatter={(v) => fmt(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Net Cash" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
