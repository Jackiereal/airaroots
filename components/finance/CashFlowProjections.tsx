'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { HistoricalAverages } from '@/app/api/finance/[propertyId]/historical-averages/route';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Assumptions = {
  baseNightlyRate: number;
  occupancyPct: number;
  monthlyExpenses: number;
  totalMonthlyEmi: number;
  extraMonthlyRevenue: number;
};

type ProjectionRow = {
  month: string;
  revenue: number;
  expenses: number;
  emi: number;
  net: number;
  cumulative: number;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function fmt(n: number) {
  return '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function buildProjections(a: Assumptions): ProjectionRow[] {
  const rows: ProjectionRow[] = [];
  const now = new Date();
  let cumulative = 0;
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const days = daysInMonth(d.getFullYear(), d.getMonth() + 1);
    const nights = Math.floor(days * (a.occupancyPct / 100));
    const revenue = Math.round(nights * a.baseNightlyRate + a.extraMonthlyRevenue);
    const expenses = Math.round(a.monthlyExpenses);
    const emi = Math.round(a.totalMonthlyEmi);
    const net = revenue - expenses - emi;
    cumulative += net;
    rows.push({
      month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      revenue,
      expenses,
      emi,
      net,
      cumulative: Math.round(cumulative),
    });
  }
  return rows;
}

const DEFAULT: Assumptions = {
  baseNightlyRate: 5000,
  occupancyPct: 65,
  monthlyExpenses: 30000,
  totalMonthlyEmi: 0,
  extraMonthlyRevenue: 0,
};

export default function CashFlowProjections({ propertyId }: { propertyId: string }) {
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [hist, setHist] = useState<HistoricalAverages | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/finance/${propertyId}/projections-config`).then((r) => r.json()),
      fetch(`/api/finance/${propertyId}/loans`).then((r) => r.json()),
      fetch(`/api/finance/${propertyId}/historical-averages`).then((r) => r.json()),
    ]).then(([cfg, loansData, histData]) => {
      const historical = histData as HistoricalAverages;
      setHist(historical);

      const savedRaw = cfg.config?.cashflow_assumptions as Partial<Assumptions> | undefined;
      const hasSaved = savedRaw != null;

      const loans: { computed_emi?: number }[] = loansData.loans ?? [];
      const emiTotal = loans.reduce((s: number, l) => s + (l.computed_emi ?? 0), 0);

      if (hasSaved) {
        setAssumptions((prev) => ({
          ...prev,
          ...savedRaw,
          totalMonthlyEmi: savedRaw?.totalMonthlyEmi ?? Math.round(emiTotal),
        }));
      } else {
        // No saved config — seed from real historical data
        setAssumptions({
          baseNightlyRate: historical.avgNightlyRate || DEFAULT.baseNightlyRate,
          occupancyPct: historical.avgOccupancyPct || DEFAULT.occupancyPct,
          monthlyExpenses: historical.avgMonthlyExpenses || DEFAULT.monthlyExpenses,
          totalMonthlyEmi: Math.round(emiTotal) || historical.totalMonthlyEmi,
          extraMonthlyRevenue: 0,
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const save = useCallback((updated: Assumptions) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/finance/${propertyId}/projections-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'cashflow_assumptions', value: updated }),
      });
    }, 800);
  }, [propertyId]);

  const update = useCallback((field: keyof Assumptions, val: number) => {
    setAssumptions((prev) => {
      const next = { ...prev, [field]: val };
      save(next);
      return next;
    });
  }, [save]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading projections...
      </div>
    );
  }

  const rows = buildProjections(assumptions);
  const annualRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const annualNet = rows.reduce((s, r) => s + r.net, 0);

  const FIELDS: { key: keyof Assumptions; label: string; prefix: string; step: number; max: number }[] = [
    { key: 'baseNightlyRate', label: 'Base Nightly Rate', prefix: '₹', step: 500, max: 50000 },
    { key: 'occupancyPct', label: 'Occupancy %', prefix: '', step: 5, max: 100 },
    { key: 'monthlyExpenses', label: 'Monthly Expenses', prefix: '₹', step: 1000, max: 200000 },
    { key: 'totalMonthlyEmi', label: 'Total Monthly EMI', prefix: '₹', step: 500, max: 200000 },
    { key: 'extraMonthlyRevenue', label: 'Extra Monthly Revenue', prefix: '₹', step: 500, max: 100000 },
  ];

  return (
    <div className="space-y-6">
      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Annual Projected Revenue', value: fmt(annualRevenue), tone: 'income' },
          { label: 'Annual Net Cash Flow', value: fmt(annualNet), tone: annualNet >= 0 ? 'profit' : 'rose' },
          { label: 'Avg Monthly Revenue', value: fmt(Math.round(annualRevenue / 12)), tone: 'sky' },
          { label: 'Avg Monthly Net', value: fmt(Math.round(annualNet / 12)), tone: annualNet >= 0 ? 'profit' : 'rose' },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border p-3 ${
            k.tone === 'income' ? 'border-[var(--tone-income-bd)] bg-[var(--tone-income-bg)]'
            : k.tone === 'profit' ? 'border-[var(--tone-profit-bd)] bg-[var(--tone-profit-bg)]'
            : k.tone === 'rose'   ? 'border-[var(--tone-rose-bd)]   bg-[var(--tone-rose-bg)]'
            :                       'border-[var(--tone-profit-bd)] bg-[var(--tone-profit-bg)]'
          }`}>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">{k.label}</p>
            <p className={`text-xl font-bold mt-1 tabular-nums ${
              k.tone === 'income' ? 'text-[var(--tone-income-tx)]'
              : k.tone === 'profit' ? 'text-[var(--tone-profit-tx)]'
              : k.tone === 'rose'   ? 'text-[var(--tone-rose-tx)]'
              :                       'text-[var(--tone-profit-tx)]'
            }`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Assumption inputs */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Projection Assumptions</p>
          {hist && hist.monthsAnalyzed > 0 && (
            <button
              type="button"
              onClick={() => {
                const next: Assumptions = {
                  baseNightlyRate: hist.avgNightlyRate,
                  occupancyPct: hist.avgOccupancyPct,
                  monthlyExpenses: hist.avgMonthlyExpenses,
                  totalMonthlyEmi: hist.totalMonthlyEmi,
                  extraMonthlyRevenue: assumptions.extraMonthlyRevenue,
                };
                setAssumptions(next);
                save(next);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              title={`Seed from ${hist.monthsAnalyzed} months of real data`}
            >
              <RefreshCw className="h-3 w-3" />
              Seed from history
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-xs text-[var(--text-secondary)] mb-1 block">{f.label}</span>
              <div className="flex items-center gap-2">
                {f.prefix && <span className="text-sm text-[var(--text-secondary)]">{f.prefix}</span>}
                <input
                  type="number"
                  value={assumptions[f.key]}
                  step={f.step}
                  min={0}
                  max={f.max}
                  onChange={(e) => update(f.key, Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--text-secondary)]">
          Auto-saved on change
          {hist && hist.monthsAnalyzed > 0 && (
            <span className="ml-2 text-[var(--accent)]/70">· based on {hist.monthsAnalyzed} months of actuals</span>
          )}
        </p>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">12-Month Cash Flow Projection</p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" fill="var(--accent)" name="Revenue" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" fill="#f97316" name="Expenses" stackId="costs" radius={[0, 0, 0, 0]} />
            <Bar dataKey="emi" fill="#ef4444" name="EMI" stackId="costs" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="net" stroke="#14b8a6" strokeWidth={2} dot={false} name="Net Cash Flow" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
              {['Month', 'Revenue', 'Expenses', 'EMI', 'Net', 'Cumulative'].map((h) => (
                <th key={h} className={`px-4 py-2 font-medium ${h === 'Month' ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month} className="border-b border-[var(--border-color)]/40 hover:bg-[var(--bg-elevated)]/50">
                <td className="px-4 py-2">{row.month}</td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--accent)]">{fmt(row.revenue)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-orange-400">{fmt(row.expenses)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-rose-400">{fmt(row.emi)}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-medium ${row.net >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>{fmt(row.net)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${row.cumulative >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>{fmt(row.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
