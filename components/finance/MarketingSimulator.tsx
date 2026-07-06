'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Minus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import type { HistoricalAverages } from '@/app/api/finance/[propertyId]/historical-averages/route';
import {
  Bar, CartesianGrid, Cell, ComposedChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type ChannelKey = 'google' | 'instagram' | 'facebook' | 'influencer';
type MarketingSpend = Record<ChannelKey, number>;

const CHANNELS: { id: ChannelKey; label: string; color: string }[] = [
  { id: 'google',    label: 'Google Ads',     color: '#4285f4' },
  { id: 'instagram', label: 'Instagram Ads',  color: '#e1306c' },
  { id: 'facebook',  label: 'Facebook Ads',   color: '#1877f2' },
  { id: 'influencer',label: 'Influencer',     color: '#a855f7' },
];

const DEFAULT_SPEND: MarketingSpend = { google: 0, instagram: 0, facebook: 0, influencer: 0 };

type AirbnbExpense = { period_month: string; expense_type: string; amount: number };

const CHANNEL_KEYWORDS: Record<ChannelKey, string[]> = {
  google:     ['google'],
  instagram:  ['instagram', 'insta'],
  facebook:   ['facebook', 'fb'],
  influencer: ['influencer'],
};

function matchChannel(expenseType: string): ChannelKey | null {
  const lower = expenseType.toLowerCase();
  for (const [ch, kws] of Object.entries(CHANNEL_KEYWORDS) as [ChannelKey, string[]][]) {
    if (kws.some((k) => lower.includes(k))) return ch;
  }
  return null;
}

function isMarketingExpense(expenseType: string): boolean {
  const l = expenseType.toLowerCase();
  return l.includes('marketing') || l.includes('ads') ||
    l.includes('advertis') || l.includes('influencer') || l.includes('campaign');
}

function seedSpendFromExpenses(expenses: AirbnbExpense[], currentMonth: string): MarketingSpend {
  const thisMonth = expenses.filter(
    (e) => e.period_month.slice(0, 7) === currentMonth && isMarketingExpense(e.expense_type),
  );
  const out: MarketingSpend = { google: 0, instagram: 0, facebook: 0, influencer: 0 };
  let unmatched = 0;
  for (const e of thisMonth) {
    const ch = matchChannel(e.expense_type);
    if (ch) out[ch] += Number(e.amount);
    else unmatched += Number(e.amount);
  }
  if (unmatched > 0) {
    const each = Math.round(unmatched / 4);
    for (const k of Object.keys(out) as ChannelKey[]) out[k] += each;
  }
  return out;
}

function computeAvgMonthlyMarketing(expenses: AirbnbExpense[]): number {
  const mkt = expenses.filter((e) => isMarketingExpense(e.expense_type));
  if (!mkt.length) return 0;
  const byMonth: Record<string, number> = {};
  for (const e of mkt) byMonth[e.period_month] = (byMonth[e.period_month] ?? 0) + Number(e.amount);
  const vals = Object.values(byMonth);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function fmt(n: number) {
  return '₹' + Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtAxis(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000)   return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}

export default function MarketingSimulator({ propertyId }: { propertyId: string }) {
  const [spend, setSpend]               = useState<MarketingSpend>(DEFAULT_SPEND);
  const [loading, setLoading]           = useState(true);
  const [allExpenses, setAllExpenses]   = useState<AirbnbExpense[]>([]);
  const [actualRevenue, setActualRevenue]     = useState<number | null>(null);
  const [actualBookings, setActualBookings]   = useState<number | null>(null);
  const [seasonalBaseline, setSeasonalBaseline] = useState<number>(0);
  const [avgHistMarketing, setAvgHistMarketing] = useState<number>(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentMonth     = new Date().toISOString().slice(0, 7);
    const currentMonthIdx  = new Date().getMonth(); // 0-based

    Promise.all([
      fetch(`/api/finance/${propertyId}/historical-averages`).then((r) => r.json()),
      fetch(`/api/finance/${propertyId}/projections-config`).then((r) => r.json()),
      fetch(`/api/finance/${propertyId}/expenses`).then((r) => r.json()),
      fetch(`/api/finance/${propertyId}/summary?month=${currentMonth}`).then((r) => r.json()).catch(() => null),
    ]).then(([histData, cfgData, expData, dashData]) => {
      const historical = histData as HistoricalAverages;
      const expenses: AirbnbExpense[] = expData.expenses ?? [];
      setAllExpenses(expenses);
      setAvgHistMarketing(computeAvgMonthlyMarketing(expenses));

      if (dashData?.revenue    != null) setActualRevenue(dashData.revenue);
      if (dashData?.bookingCount != null) setActualBookings(dashData.bookingCount);

      // Seasonal baseline: what this month earns organically based on history
      const seasonEntry = historical.seasonality?.[currentMonthIdx];
      setSeasonalBaseline(
        Math.round((historical.avgMonthlyRevenue ?? 0) * (seasonEntry?.revenueMultiplier ?? 1.0)),
      );

      const saved = cfgData.config?.marketing_spend as MarketingSpend | undefined;
      setSpend(saved ?? seedSpendFromExpenses(expenses, currentMonth));
    }).finally(() => setLoading(false));
  }, []);

  const save = useCallback((next: MarketingSpend) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/finance/${propertyId}/projections-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'marketing_spend', value: next }),
      });
    }, 800);
  }, [propertyId]);

  const updateSpend = useCallback((channel: ChannelKey, val: number) => {
    setSpend((prev) => {
      const next = { ...prev, [channel]: val };
      save(next);
      return next;
    });
  }, [save]);

  const seedFromExpenses = useCallback(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const next = seedSpendFromExpenses(allExpenses, currentMonth);
    setSpend(next);
    save(next);
  }, [allExpenses, save]);

  const analysis = useMemo(() => {
    const totalSpend = Object.values(spend).reduce((s, v) => s + v, 0);
    const uplift  = actualRevenue != null ? actualRevenue - seasonalBaseline : null;
    const netGain = uplift != null && totalSpend > 0 ? uplift - totalSpend : null;
    const roi     = uplift != null && totalSpend > 0 ? (uplift / totalSpend) * 100 : null;
    return { totalSpend, uplift, netGain, roi };
  }, [spend, actualRevenue, seasonalBaseline]);

  const chartData = useMemo(() =>
    CHANNELS.map(({ id, label }) => ({ channel: label.replace(' Ads', ''), spend: spend[id] })),
    [spend],
  );

  const currentMonthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  const { totalSpend, uplift, netGain, roi } = analysis;
  const hasData = actualRevenue != null && totalSpend > 0;

  // Verdict
  let verdictBorder  = 'border-[var(--border-color)] bg-[var(--bg-surface)]';
  let verdictColor   = 'text-[var(--text-secondary)]';
  let VerdictIcon    = Minus;
  let verdictTitle   = 'Enter your marketing spend below to see analysis';
  let verdictDetail  = '';

  if (hasData && netGain != null) {
    if (netGain > 0) {
      verdictBorder  = 'border-teal-500/40 bg-teal-950/30';
      verdictColor   = 'text-teal-300';
      VerdictIcon    = TrendingUp;
      verdictTitle   = `Marketing paid off — ${fmt(netGain)} net gain this month`;
      verdictDetail  = `Revenue grew ${fmt(Math.abs(uplift!))} above seasonal baseline vs ${fmt(totalSpend)} spent. You could have spent up to ${fmt(netGain)} more and still been profitable.`;
    } else if (netGain < 0) {
      verdictBorder  = 'border-rose-500/40 bg-rose-950/30';
      verdictColor   = 'text-rose-300';
      VerdictIcon    = TrendingDown;
      verdictTitle   = `Overspent by ${fmt(Math.abs(netGain))}`;
      verdictDetail  = `Marketing cost ${fmt(totalSpend)} but only generated ${uplift! >= 0 ? fmt(Math.abs(uplift!)) : 'negative'} uplift above baseline. Cut budget or shift spend to better-performing channels.`;
    } else {
      verdictTitle   = 'Break-even — marketing revenue exactly matched spend';
    }
  } else if (hasData && uplift != null && uplift < 0) {
    verdictBorder  = 'border-amber-500/40 bg-amber-950/30';
    verdictColor   = 'text-amber-300';
    VerdictIcon    = TrendingDown;
    verdictTitle   = `Revenue below seasonal baseline by ${fmt(Math.abs(uplift))}`;
    verdictDetail  = `This month underperformed even before accounting for marketing spend. Check occupancy or pricing.`;
  }

  return (
    <div className="space-y-6">

      {/* Verdict banner */}
      <div className={`rounded-xl border p-4 ${verdictBorder}`}>
        <div className="flex items-start gap-3">
          <VerdictIcon className={`h-5 w-5 mt-0.5 shrink-0 ${verdictColor}`} />
          <div>
            <p className={`text-sm font-semibold ${verdictColor}`}>{verdictTitle}</p>
            {verdictDetail && <p className="text-xs text-[var(--text-secondary)] mt-1">{verdictDetail}</p>}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Total Spend</p>
          <p className="text-base font-bold mt-1 tabular-nums text-[var(--text-primary)]">{fmt(totalSpend)}</p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            {avgHistMarketing > 0 ? `hist avg: ${fmt(Math.round(avgHistMarketing))}/mo` : currentMonthLabel}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Seasonal Baseline</p>
          <p className="text-base font-bold mt-1 tabular-nums text-[var(--text-primary)]">
            {seasonalBaseline > 0 ? fmt(seasonalBaseline) : '—'}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">expected without marketing</p>
        </div>

        <div className="rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/[0.11] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Actual Revenue</p>
          <p className="text-base font-bold mt-1 tabular-nums text-[var(--accent)]">
            {actualRevenue != null ? fmt(Math.round(actualRevenue)) : '—'}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            {actualBookings != null ? `${actualBookings} bookings this month` : currentMonthLabel}
          </p>
        </div>

        <div className={`rounded-xl border p-3 ${
          roi == null
            ? 'border-[var(--border-color)] bg-[var(--bg-surface)]'
            : roi >= 100
              ? 'border-teal-500/45 bg-teal-950/35'
              : 'border-rose-500/45 bg-rose-950/30'
        }`}>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Marketing ROI</p>
          <p className={`text-base font-bold mt-1 tabular-nums ${
            roi == null ? 'text-[var(--text-primary)]' : roi >= 100 ? 'text-teal-200' : 'text-rose-300'
          }`}>
            {roi != null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(0)}%` : '—'}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            {uplift != null
              ? `uplift: ${uplift >= 0 ? '+' : '−'}${fmt(Math.abs(Math.round(uplift)))}`
              : 'enter spend below'}
          </p>
        </div>
      </div>

      {/* Spend inputs */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Channel Spend — {currentMonthLabel}
          </p>
          <button
            type="button"
            onClick={seedFromExpenses}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            <RefreshCw className="h-3 w-3" />
            Reload from expenses
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CHANNELS.map(({ id, label, color }) => (
            <div key={id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
              </div>
              <input
                type="number"
                value={spend[id]}
                min={0}
                step={500}
                onChange={(e) => updateSpend(id, Number(e.target.value))}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              {totalSpend > 0 && spend[id] > 0 && (
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  {((spend[id] / totalSpend) * 100).toFixed(0)}% of budget
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-secondary)]/60 mt-3">Auto-saved · Pre-filled from this month&apos;s expense records</p>
      </div>

      {/* Chart */}
      {totalSpend > 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Spend by Channel</p>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="channel" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={fmtAxis} />
              <Tooltip
                formatter={(v) => [fmt(Number(v)), 'Spend']}
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }}
              />
              <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={CHANNELS[i].color} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Analysis breakdown table */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
              <th className="px-4 py-3 text-left font-medium">Metric</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: 'Seasonal baseline (historical avg × this month multiplier)',
                value: seasonalBaseline > 0 ? fmt(seasonalBaseline) : '—',
                color: 'text-[var(--text-primary)]',
              },
              {
                label: 'Actual revenue this month',
                value: actualRevenue != null ? fmt(Math.round(actualRevenue)) : '—',
                color: 'text-[var(--accent)]',
              },
              {
                label: 'Revenue uplift above baseline',
                value: uplift != null
                  ? `${uplift >= 0 ? '+' : '−'}${fmt(Math.abs(Math.round(uplift)))}`
                  : '—',
                color: uplift == null ? 'text-[var(--text-primary)]' : uplift >= 0 ? 'text-teal-300' : 'text-rose-300',
              },
              {
                label: 'Total marketing spend',
                value: fmt(totalSpend),
                color: 'text-[var(--text-primary)]',
              },
              {
                label: 'Net gain / loss (uplift − spend)',
                value: netGain != null
                  ? `${netGain >= 0 ? '+' : '−'}${fmt(Math.abs(Math.round(netGain)))}`
                  : '—',
                color: netGain == null ? 'text-[var(--text-primary)]' : netGain >= 0 ? 'text-teal-300' : 'text-rose-300',
                bold: true,
              },
              {
                label: 'Marketing ROI (uplift ÷ spend)',
                value: roi != null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '—',
                color: roi == null ? 'text-[var(--text-primary)]' : roi >= 100 ? 'text-teal-300' : 'text-rose-300',
              },
            ].map(({ label, value, color, bold }) => (
              <tr key={label} className="border-b border-[var(--border-color)]/40">
                <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{label}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums text-sm ${color} ${bold ? 'font-semibold' : ''}`}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-[10px] text-[var(--text-secondary)]/50">
          Uplift assumes revenue above seasonal baseline is attributed to marketing. Baseline uses historical monthly avg × this month&apos;s seasonal multiplier.
        </p>
      </div>

    </div>
  );
}
