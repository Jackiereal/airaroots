'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { HistoricalAverages } from '@/app/api/finance/[propertyId]/historical-averages/route';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type MonthConfig = {
  multiplier: number;
  occupancyPct: number;
};

type PricingConfig = {
  baseRate: number;
  weekdayDiscountPct: number;
  months: MonthConfig[];
};

function daysInMonthOfYear(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function countWeekdays(year: number, month: number): number {
  let count = 0;
  const days = daysInMonthOfYear(year, month);
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow >= 1 && dow <= 4) count++;
  }
  return count;
}

function computeMonthlyRevenue(cfg: PricingConfig, year: number): { month: string; revenue: number; nights: number }[] {
  return MONTHS.map((label, i) => {
    const days = daysInMonthOfYear(year, i);
    const mc = cfg.months[i] ?? { multiplier: 1, occupancyPct: 65 };
    const nights = Math.floor(days * (mc.occupancyPct / 100));
    const weekdays = countWeekdays(year, i);
    const weekends = days - weekdays;
    const rate = cfg.baseRate * mc.multiplier;
    const revenue = Math.round(
      (weekdays * rate * (1 - cfg.weekdayDiscountPct / 100) + weekends * rate) * (mc.occupancyPct / 100)
    );
    return { month: label, revenue: Math.max(0, revenue), nights };
  });
}

function fmt(n: number) {
  return '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const MONTH_COLORS = [
  '#1db954', '#22c55e', '#16a34a', '#15803d', '#14532d', '#1d4ed8',
  '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#f97316', '#fb923c',
];

const DEFAULT_CFG: PricingConfig = {
  baseRate: 5000,
  weekdayDiscountPct: 10,
  months: MONTHS.map(() => ({ multiplier: 1.0, occupancyPct: 65 })),
};

function configFromHistory(h: HistoricalAverages): PricingConfig {
  return {
    baseRate: h.avgNightlyRate || DEFAULT_CFG.baseRate,
    weekdayDiscountPct: DEFAULT_CFG.weekdayDiscountPct,
    months: MONTHS.map((_, i) => ({
      multiplier: 1.0,
      occupancyPct: h.seasonality[i]?.dataPoints > 0
        ? h.seasonality[i].avgOccupancyPct
        : (h.avgOccupancyPct || (DEFAULT_CFG.months[i]?.occupancyPct ?? 65)),
    })),
  };
}

export default function PricingSimulator({ propertyId }: { propertyId: string }) {
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CFG);
  const [loading, setLoading] = useState(true);
  const [historicalRevenue, setHistoricalRevenue] = useState<number[]>([]);
  const [hist, setHist] = useState<HistoricalAverages | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/finance/${propertyId}/projections-config`).then((r) => r.json()),
      fetch(`/api/finance/${propertyId}/historical-averages`).then((r) => r.json()),
    ]).then(([cfgData, histData]) => {
      const historical = histData as HistoricalAverages;
      setHist(historical);

      const saved = cfgData.config?.pricing_config as PricingConfig | undefined;
      if (saved) {
        setConfig(saved);
      } else if (historical.monthsAnalyzed > 0) {
        setConfig(configFromHistory(historical));
      }

      const prevYearRevenue = MONTHS.map((_, i) => {
        const s = historical.seasonality[i];
        // rough estimate: avgRev × multiplier won't be per-year, use 0 if no data
        return s?.dataPoints > 0 ? Math.round(historical.avgMonthlyRevenue * s.revenueMultiplier) : 0;
      });
      setHistoricalRevenue(prevYearRevenue);
    }).finally(() => setLoading(false));
  }, []);

  const save = useCallback((cfg: PricingConfig) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/finance/${propertyId}/projections-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'pricing_config', value: cfg }),
      });
    }, 800);
  }, [propertyId]);

  const updateBase = useCallback((field: 'baseRate' | 'weekdayDiscountPct', val: number) => {
    setConfig((prev) => { const next = { ...prev, [field]: val }; save(next); return next; });
  }, [save]);

  const updateMonth = useCallback((i: number, field: keyof MonthConfig, val: number) => {
    setConfig((prev) => {
      const months = prev.months.map((m, idx) => idx === i ? { ...m, [field]: val } : m);
      const next = { ...prev, months };
      save(next);
      return next;
    });
  }, [save]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading simulator...
      </div>
    );
  }

  const year = new Date().getFullYear();
  const projected = computeMonthlyRevenue(config, year);
  const annual = projected.reduce((s, r) => s + r.revenue, 0);
  const best = [...projected].sort((a, b) => b.revenue - a.revenue)[0];
  const worst = [...projected].sort((a, b) => a.revenue - b.revenue)[0];

  const hasHistorical = historicalRevenue.some((v) => v > 0);
  const chartData = projected.map((p, i) => ({
    month: p.month,
    Projected: p.revenue,
    ...(hasHistorical ? { 'Last Year': historicalRevenue[i] } : {}),
  }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Annual Projected', value: fmt(annual), color: 'text-[var(--accent)]', border: 'border-[var(--accent)]/50 bg-[var(--accent)]/[0.11]' },
          { label: 'Best Month', value: `${best?.month} — ${fmt(best?.revenue ?? 0)}`, color: 'text-teal-200', border: 'border-teal-500/45 bg-teal-950/35' },
          { label: 'Worst Month', value: `${worst?.month} — ${fmt(worst?.revenue ?? 0)}`, color: 'text-rose-200', border: 'border-rose-500/45 bg-rose-950/30' },
          { label: 'Avg Monthly', value: fmt(Math.round(annual / 12)), color: 'text-sky-200', border: 'border-sky-500/45 bg-sky-950/30' },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border p-3 ${k.border}`}>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">{k.label}</p>
            <p className={`text-base font-bold mt-1 tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Base controls */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Base Configuration</p>
          {hist && hist.monthsAnalyzed > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = configFromHistory(hist);
                setConfig(next);
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-[var(--text-secondary)] mb-1 block">Base Nightly Rate (₹)</span>
            <input
              type="number"
              value={config.baseRate}
              min={0}
              step={500}
              onChange={(e) => updateBase('baseRate', Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--text-secondary)] mb-1 block">Weekday Discount % (Mon–Thu)</span>
            <input
              type="number"
              value={config.weekdayDiscountPct}
              min={0}
              max={50}
              step={1}
              onChange={(e) => updateBase('weekdayDiscountPct', Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </label>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Projected Revenue by Month — {year}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Projected" radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={MONTH_COLORS[i % MONTH_COLORS.length]} />)}
            </Bar>
            {hasHistorical && <Bar dataKey="Last Year" fill="#6b7280" radius={[3, 3, 0, 0]} opacity={0.5} />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-month config table */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
        <p className="text-sm font-medium text-[var(--text-secondary)] px-4 py-3 border-b border-[var(--border-color)]">Seasonal Configuration</p>
        <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
              <th className="px-4 py-2 text-left font-medium">Month</th>
              <th className="px-4 py-2 text-center font-medium">Rate Multiplier</th>
              <th className="px-4 py-2 text-center font-medium">Occupancy %</th>
              <th className="px-4 py-2 text-right font-medium">Effective Rate</th>
              <th className="px-4 py-2 text-right font-medium">Projected</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((label, i) => {
              const mc = config.months[i] ?? { multiplier: 1, occupancyPct: 65 };
              return (
                <tr key={label} className="border-b border-[var(--border-color)]/40">
                  <td className="px-4 py-1.5 font-medium">{label}</td>
                  <td className="px-4 py-1.5">
                    <input
                      type="number"
                      value={mc.multiplier}
                      min={0.1}
                      max={5}
                      step={0.1}
                      onChange={(e) => updateMonth(i, 'multiplier', Number(e.target.value))}
                      className="w-20 mx-auto block rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-center text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  <td className="px-4 py-1.5">
                    <input
                      type="number"
                      value={mc.occupancyPct}
                      min={0}
                      max={100}
                      step={5}
                      onChange={(e) => updateMonth(i, 'occupancyPct', Number(e.target.value))}
                      className="w-20 mx-auto block rounded border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-center text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                    {fmt(Math.round(config.baseRate * mc.multiplier))}
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums font-medium text-[var(--accent)]">
                    {fmt(projected[i]?.revenue ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
