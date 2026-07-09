'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ResponsiveTable, TableCard } from '@/components/ui/ResponsiveTable';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Expense = {
  id: string;
  period_month: string;
  expense_type: string;
  amount: number;
  expense_date: string | null;
  notes: string | null;
  paid_from: string;
};

type ViewMode = 'monthly' | 'quarterly' | 'yearly';

function fmt(n: number) {
  return '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const PIE_COLORS = [
  '#1db954', '#f97316', '#3b82f6', '#a855f7', '#ec4899',
  '#14b8a6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16',
];

function getCategoryLabel(expenseType: string): string {
  const idx = expenseType.indexOf(' / ');
  return idx > 0 ? expenseType.slice(0, idx) : expenseType;
}

function groupByCategory(expenses: Expense[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    const label = getCategoryLabel(e.expense_type);
    out[label] = (out[label] ?? 0) + Number(e.amount);
  }
  return out;
}

function getPeriodMonthStr(pm: string): string {
  // period_month comes back as date string '2026-06-01' from DB
  return pm.slice(0, 7);
}

function quarterLabel(ym: string): string {
  const m = parseInt(ym.slice(5, 7));
  const y = ym.slice(0, 4);
  const q = Math.ceil(m / 3);
  return `Q${q} ${y}`;
}

function getQuarter(ym: string): string {
  const m = parseInt(ym.slice(5, 7));
  const y = ym.slice(0, 4);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

export default function ExpenseEngine({ month, propertyId }: { month: string; propertyId: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('monthly');

  const year = month.slice(0, 4);

  useEffect(() => {
    fetch(`/api/finance/${propertyId}/expenses?all=1`)
      .then((r) => r.json())
      .then((d) => setExpenses(d.expenses ?? []))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading expenses...
      </div>
    );
  }

  // Current month expenses
  const monthlyExpenses = expenses.filter(
    (e) => getPeriodMonthStr(e.period_month) === month
  );

  // Yearly expenses (current year)
  const yearlyExpenses = expenses.filter((e) => e.period_month.startsWith(year));

  // Category breakdown for pie (monthly)
  const catMap = groupByCategory(view === 'monthly' ? monthlyExpenses : yearlyExpenses);
  const pieData = Object.entries(catMap)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  const totalShown = pieData.reduce((s, d) => s + d.value, 0);

  // Quarterly chart data
  const quarterlyMap: Record<string, Record<string, number>> = {};
  for (const e of yearlyExpenses) {
    const ym = getPeriodMonthStr(e.period_month);
    const q = getQuarter(ym);
    const label = getCategoryLabel(e.expense_type);
    if (!quarterlyMap[q]) quarterlyMap[q] = {};
    quarterlyMap[q][label] = (quarterlyMap[q][label] ?? 0) + Number(e.amount);
  }
  const allCategories = [...new Set(yearlyExpenses.map((e) => getCategoryLabel(e.expense_type)))];
  const quarterlyData = Object.entries(quarterlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([q, cats]) => ({ quarter: quarterLabel(q.replace('-Q', '-0').replace('Q1', '01').replace('Q2', '04').replace('Q3', '07').replace('Q4', '10').slice(0, 7)), q, ...cats }));

  // Yearly monthly chart
  const monthlyMap: Record<string, Record<string, number>> = {};
  for (const e of yearlyExpenses) {
    const ym = getPeriodMonthStr(e.period_month);
    const label = getCategoryLabel(e.expense_type);
    if (!monthlyMap[ym]) monthlyMap[ym] = {};
    monthlyMap[ym][label] = (monthlyMap[ym][label] ?? 0) + Number(e.amount);
  }
  const yearlyChartData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, cats]) => ({
      month: new Date(ym + '-01').toLocaleDateString('en-IN', { month: 'short' }),
      total: Object.values(cats).reduce((s, v) => s + v, 0),
      ...cats,
    }));

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex items-center gap-3">
        <div className="flex gap-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5">
          {(['monthly', 'quarterly', 'yearly'] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                'px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors',
                view === v
                  ? 'bg-[var(--bg-raised)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="text-sm text-[var(--text-secondary)]">
          {view === 'monthly' ? month : year}
          {' · '}
          <span className="font-medium text-[var(--text-primary)]">{fmt(totalShown)} total</span>
        </span>
      </div>

      {/* Pie chart always visible */}
      {pieData.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              Expense Breakdown {view === 'monthly' ? `(${month})` : `(${year})`}
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category table */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 overflow-auto">
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">By Category</p>
            <ResponsiveTable
              table={
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-secondary)]">
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pieData.map((row, i) => (
                      <tr key={row.name} className="border-b border-[var(--border-color)]/40">
                        <td className="py-1.5 flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="capitalize">{row.name.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(row.value)}</td>
                        <td className="py-1.5 text-right text-[var(--text-secondary)] tabular-nums">
                          {totalShown > 0 ? ((row.value / totalShown) * 100).toFixed(1) : '0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
              cards={
                <div className="space-y-3">
                  {pieData.map((row, i) => (
                    <TableCard
                      key={row.name}
                      title={
                        <span className="flex items-center gap-2 font-medium text-sm text-[var(--text-primary)] capitalize">
                          <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {row.name.replace(/_/g, ' ')}
                        </span>
                      }
                      titleExtra={<span className="text-sm text-[var(--text-primary)]">{fmt(row.value)}</span>}
                      fields={[
                        { label: '%', value: totalShown > 0 ? `${((row.value / totalShown) * 100).toFixed(1)}%` : '0%' },
                      ]}
                    />
                  ))}
                </div>
              }
            />
          </div>
        </div>
      )}

      {/* Quarterly bar chart */}
      {view === 'quarterly' && quarterlyData.length > 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Quarterly Expenses by Category</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={quarterlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {allCategories.slice(0, 8).map((cat, i) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={PIE_COLORS[i % PIE_COLORS.length]} name={cat.replace(/_/g, ' ')} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Yearly line/bar chart */}
      {view === 'yearly' && yearlyChartData.length > 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Monthly Expenses — {year}</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={yearlyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2} dot={false} name="Total" />
              {allCategories.slice(0, 4).map((cat, i) => (
                <Line key={cat} type="monotone" dataKey={cat} stroke={PIE_COLORS[(i + 1) % PIE_COLORS.length]} strokeWidth={1.5} dot={false} name={cat.replace(/_/g, ' ')} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly list */}
      {view === 'monthly' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div className="p-4 border-b border-[var(--border-color)]">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Expenses — {month}</p>
          </div>
          {monthlyExpenses.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-secondary)]">No expenses for {month}.</p>
          ) : (
            <ResponsiveTable
              table={
                <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
                        <th className="px-4 py-2 text-left font-medium">Category</th>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-left font-medium">Notes</th>
                        <th className="px-4 py-2 text-right font-medium">Amount</th>
                        <th className="px-4 py-2 text-left font-medium">Paid From</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyExpenses.map((e) => (
                        <tr key={e.id} className="border-b border-[var(--border-color)]/40 hover:bg-[var(--bg-elevated)]/50">
                          <td className="px-4 py-2 capitalize">{e.expense_type.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">{e.expense_date ?? '—'}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)] max-w-[200px] truncate">{e.notes ?? '—'}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(Number(e.amount))}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)] capitalize">{e.paid_from?.replace(/_/g, ' ') ?? '—'}</td>
                        </tr>
                      ))}
                      <tr className="bg-[var(--bg-elevated)]/40">
                        <td colSpan={3} className="px-4 py-2 text-sm font-medium">Total</td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums">{fmt(monthlyExpenses.reduce((s, e) => s + Number(e.amount), 0))}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              }
              cards={
                <div className="p-4 space-y-3">
                  {monthlyExpenses.map((e) => (
                    <TableCard
                      key={e.id}
                      title={<span className="font-medium text-sm text-[var(--text-primary)] capitalize">{e.expense_type.replace(/_/g, ' ')}</span>}
                      titleExtra={<span className="font-medium text-sm text-[var(--text-primary)]">{fmt(Number(e.amount))}</span>}
                      fields={[
                        { label: 'Date', value: e.expense_date ?? '—' },
                        { label: 'Paid From', value: <span className="capitalize">{e.paid_from?.replace(/_/g, ' ') ?? '—'}</span> },
                        { label: 'Notes', value: e.notes ?? '—' },
                      ]}
                    />
                  ))}
                  <div className="rounded-xl border-2 border-[var(--border-color)] bg-[var(--bg-elevated)]/40 p-4 flex items-center justify-between">
                    <span className="font-medium text-sm text-[var(--text-primary)]">Total</span>
                    <span className="font-bold text-sm text-[var(--text-primary)]">
                      {fmt(monthlyExpenses.reduce((s, e) => s + Number(e.amount), 0))}
                    </span>
                  </div>
                </div>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
