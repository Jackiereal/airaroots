'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { buildSchedule } from '@/lib/finance/loan-calc';
import type { HistoricalAverages } from '@/app/api/finance/[propertyId]/historical-averages/route';
import {
  Bar, CartesianGrid, Cell, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type Loan = {
  id: string;
  name: string;
  principal: number;
  interest_rate: number;
  start_date: string;
  tenure_months: number;
  emi_override: number | null;
  computed_emi: number;
  is_active: boolean;
};

type Inputs = {
  monthlyRevenue: number;
  monthlyExpenses: number;
  initialInvestment: number;
};

type SimRow = {
  label: string;
  revenue: number;
  expenses: number;
  emi: number;
  net: number;
  loanBalance: number;
  cumulative: number;
};

function fmt(n: number) {
  return '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtAxis(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return fmt(n);
}

function getLoanCurrentBalance(loan: Loan): number {
  const sched = buildSchedule({
    principal: loan.principal,
    annualRate: loan.interest_rate,
    tenureMonths: loan.tenure_months,
    startDate: loan.start_date,
    emiOverride: loan.emi_override,
  });
  const todayYm = new Date().toISOString().slice(0, 7);
  for (let i = 0; i < sched.rows.length; i++) {
    if (sched.rows[i].date.slice(0, 7) >= todayYm) {
      return i === 0 ? loan.principal : (sched.rows[i - 1]?.closingBalance ?? 0);
    }
  }
  return 0;
}

function getBaselineDebtFreeMonths(loans: Loan[]): number {
  const now = new Date();
  let maxMonths = 0;
  for (const l of loans) {
    const sched = buildSchedule({
      principal: l.principal,
      annualRate: l.interest_rate,
      tenureMonths: l.tenure_months,
      startDate: l.start_date,
      emiOverride: l.emi_override,
    });
    const df = new Date(sched.debtFreeDate);
    const months = (df.getFullYear() - now.getFullYear()) * 12 + (df.getMonth() - now.getMonth());
    if (months > maxMonths) maxMonths = months;
  }
  return Math.max(0, maxMonths);
}

function runSimulation(inputs: Inputs, loans: Loan[]): SimRow[] {
  const rows: SimRow[] = [];
  const totalEmi = loans.reduce((s, l) => s + l.computed_emi, 0);
  let balance = loans.reduce((s, l) => s + getLoanCurrentBalance(l), 0);

  // Weighted monthly interest rate
  const totalBal = balance;
  const monthlyRate =
    totalBal > 0
      ? loans.reduce((s, l) => {
          const b = getLoanCurrentBalance(l);
          return s + (b / totalBal) * (l.interest_rate / 12 / 100);
        }, 0)
      : 0;

  // Start cumulative negative by initial investment so chart crosses 0 at true breakeven
  let cumulative = -(inputs.initialInvestment ?? 0);
  let debtFreeStreak = 0;
  const now = new Date();

  for (let i = 0; i < 120; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

    const hasDebt = balance > 0.5;
    const activeEmi = hasDebt ? Math.min(totalEmi, balance) : 0;
    const net = inputs.monthlyRevenue - inputs.monthlyExpenses - activeEmi;
    const surplus = Math.max(0, net);

    if (hasDebt) {
      const interest = balance * monthlyRate;
      const emiPrincipal = Math.max(0, Math.min(activeEmi - interest, balance));
      const extra = Math.min(surplus, Math.max(0, balance - emiPrincipal));
      balance = Math.max(0, balance - emiPrincipal - extra);
    }

    cumulative += net;

    rows.push({
      label,
      revenue: inputs.monthlyRevenue,
      expenses: inputs.monthlyExpenses,
      emi: Math.round(activeEmi),
      net: Math.round(net),
      loanBalance: Math.round(balance),
      cumulative: Math.round(cumulative),
    });

    if (!hasDebt) {
      debtFreeStreak++;
      if (debtFreeStreak >= 6 && i >= 12) break;
    } else {
      debtFreeStreak = 0;
    }
  }

  return rows;
}

export default function BreakevenCalculator({ propertyId }: { propertyId: string }) {
  const [inputs, setInputs] = useState<Inputs>({ monthlyRevenue: 0, monthlyExpenses: 0, initialInvestment: 0 });
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [hist, setHist] = useState<HistoricalAverages | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/finance/${propertyId}/loans`).then((r) => r.json()),
      fetch(`/api/finance/${propertyId}/historical-averages`).then((r) => r.json()),
      fetch(`/api/finance/${propertyId}/projections-config`).then((r) => r.json()),
    ]).then(([loansData, histData, cfgData]) => {
      const activeLoans = (loansData.loans ?? []).filter((l: Loan) => l.is_active);
      setLoans(activeLoans);
      const historical = histData as HistoricalAverages;
      setHist(historical);
      const saved = cfgData.config?.breakeven_inputs as Inputs | undefined;
      if (saved) {
        setInputs({ ...saved, initialInvestment: saved.initialInvestment ?? 0 });
      } else {
        setInputs({
          monthlyRevenue: historical.avgMonthlyRevenue || 50000,
          monthlyExpenses: historical.avgMonthlyExpenses || 30000,
          initialInvestment: 0,
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const save = useCallback((next: Inputs) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/finance/${propertyId}/projections-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'breakeven_inputs', value: next }),
      });
    }, 800);
  }, [propertyId]);

  const update = useCallback(
    (field: keyof Inputs, val: number) => {
      setInputs((prev) => {
        const next = { ...prev, [field]: val };
        save(next);
        return next;
      });
    },
    [save],
  );

  const seedFromHistory = useCallback(() => {
    if (!hist) return;
    const next: Inputs = {
      monthlyRevenue: hist.avgMonthlyRevenue || inputs.monthlyRevenue,
      monthlyExpenses: hist.avgMonthlyExpenses || inputs.monthlyExpenses,
      initialInvestment: inputs.initialInvestment,
    };
    setInputs(next);
    save(next);
  }, [hist, inputs, save]);

  const rows = useMemo(() => {
    if (!loans.length) return [];
    return runSimulation(inputs, loans);
  }, [inputs, loans]);

  const totalEmi = loans.reduce((s, l) => s + l.computed_emi, 0);
  const monthlySurplus = inputs.monthlyRevenue - inputs.monthlyExpenses - totalEmi;
  const operationalBreakeven = monthlySurplus >= 0;
  const debtFreeIdx = rows.findIndex((r) => r.loanBalance === 0);
  const baselineMonths = useMemo(() => (loans.length ? getBaselineDebtFreeMonths(loans) : 0), [loans]);
  const monthsSaved = debtFreeIdx >= 0 ? Math.max(0, baselineMonths - debtFreeIdx) : 0;
  const cumulativeAtDebtFree = debtFreeIdx >= 0 ? (rows[debtFreeIdx]?.cumulative ?? 0) : null;
  // Month when cumulative cash (after initial investment) turns positive
  const trueBreakevenIdx = inputs.initialInvestment > 0
    ? rows.findIndex((r) => r.cumulative >= 0)
    : -1;

  const chartStep = Math.max(1, Math.floor(rows.length / 60));
  const chartData = rows.filter((_, i) => i % chartStep === 0);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  if (!loans.length) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">No active loans. Add loans in the Loans tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div
          className={`rounded-xl border p-3 ${operationalBreakeven ? 'border-[var(--accent)]/50 bg-[var(--accent)]/[0.11]' : 'border-rose-500/45 bg-rose-950/30'}`}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Monthly Net</p>
          <p className={`text-base font-bold mt-1 tabular-nums ${operationalBreakeven ? 'text-[var(--accent)]' : 'text-rose-300'}`}>
            {operationalBreakeven ? '+' : ''}{fmt(Math.round(monthlySurplus))}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            {operationalBreakeven ? 'surplus → prepayment' : 'shortfall / mo'}
          </p>
        </div>

        <div className={`rounded-xl border p-3 ${debtFreeIdx >= 0 ? 'border-teal-500/45 bg-teal-950/35' : 'border-[var(--border-color)] bg-[var(--bg-surface)]'}`}>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Debt-Free</p>
          <p className="text-base font-bold mt-1 text-teal-200">
            {debtFreeIdx >= 0 ? rows[debtFreeIdx]?.label : 'Beyond 10 yr'}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">with surplus prepayments</p>
        </div>

        <div className="rounded-xl border border-sky-500/45 bg-sky-950/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Months Saved</p>
          <p className="text-base font-bold mt-1 text-sky-200">{monthsSaved}</p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">vs no prepayment</p>
        </div>

        {inputs.initialInvestment > 0 ? (
          <div className={`rounded-xl border p-3 ${trueBreakevenIdx >= 0 ? 'border-amber-500/45 bg-amber-950/30' : 'border-[var(--border-color)] bg-[var(--bg-surface)]'}`}>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">True Breakeven</p>
            <p className="text-base font-bold mt-1 text-amber-200">
              {trueBreakevenIdx >= 0 ? rows[trueBreakevenIdx]?.label : 'Beyond 10 yr'}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              {trueBreakevenIdx >= 0 ? `month ${trueBreakevenIdx + 1} · full investment recovered` : 'investment not recovered in 10 yr'}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-purple-500/45 bg-purple-950/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            {inputs.initialInvestment > 0 ? 'Net Return at Debt-Free' : 'Cash at Debt-Free'}
          </p>
          <p className={`text-base font-bold mt-1 tabular-nums ${(cumulativeAtDebtFree ?? 0) >= 0 ? 'text-purple-200' : 'text-rose-300'}`}>
            {cumulativeAtDebtFree !== null ? fmt(cumulativeAtDebtFree) : '—'}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            {inputs.initialInvestment > 0 ? 'after recovering investment' : 'cumulative net'}
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Assumptions</p>
          {hist && hist.monthsAnalyzed > 0 && (
            <button
              type="button"
              onClick={seedFromHistory}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              title={`Seed from ${hist.monthsAnalyzed} months of real data`}
            >
              <RefreshCw className="h-3 w-3" />
              Seed from history
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-xs text-[var(--text-secondary)] mb-1 block">Monthly Revenue (₹)</span>
            <input
              type="number"
              value={inputs.monthlyRevenue}
              min={0}
              step={1000}
              onChange={(e) => update('monthlyRevenue', Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--text-secondary)] mb-1 block">Monthly Expenses (₹)</span>
            <input
              type="number"
              value={inputs.monthlyExpenses}
              min={0}
              step={1000}
              onChange={(e) => update('monthlyExpenses', Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--text-secondary)] mb-1 block">Initial Investment (₹)</span>
            <input
              type="number"
              value={inputs.initialInvestment}
              min={0}
              step={10000}
              onChange={(e) => update('initialInvestment', Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Down payment, setup costs…"
            />
          </label>
          <div className="block opacity-60">
            <span className="text-xs text-[var(--text-secondary)] mb-1 block">Total EMI — auto from loans</span>
            <div className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] tabular-nums">
              {fmt(Math.round(totalEmi))}
            </div>
          </div>
        </div>
        {hist && hist.monthsAnalyzed > 0 && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]/60">
            Auto-saved · seeded from {hist.monthsAnalyzed} months of actuals
          </p>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Loan Balance vs Cash Flow</p>
        <p className="text-xs text-[var(--text-secondary)]/70 mb-3">
          Surplus each month goes to prepayment — loan orange line drops faster than schedule.
          {inputs.initialInvestment > 0 && ' Cumulative cash starts at −₹' + (inputs.initialInvestment / 100000).toFixed(1) + 'L; crosses 0 at true breakeven.'}
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 52, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
            />
            <YAxis
              yAxisId="cash"
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              tickFormatter={fmtAxis}
            />
            <YAxis
              yAxisId="loan"
              orientation="right"
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              tickFormatter={fmtAxis}
            />
            <Tooltip
              formatter={(v, name) => [fmt(Number(v)), name]}
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="cash" dataKey="net" name="Monthly Net" radius={[2, 2, 0, 0]}>
              {chartData.map((r, i) => (
                <Cell key={i} fill={r.net >= 0 ? 'var(--accent)' : '#ef4444'} />
              ))}
            </Bar>
            <Line
              yAxisId="loan"
              type="monotone"
              dataKey="loanBalance"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              name="Loan Balance"
            />
            <Line
              yAxisId="cash"
              type="monotone"
              dataKey="cumulative"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
              name="Cumulative Cash"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-auto max-h-[480px]">
        <p className="text-sm font-medium text-[var(--text-secondary)] px-4 py-3 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-surface)] z-10">
          Month-by-Month Projection
        </p>
        <table className="w-full text-sm">
          <thead className="sticky top-10 bg-[var(--bg-surface)] z-10">
            <tr className="border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
              {['Month', 'Revenue', 'Expenses', 'EMI', 'Net', 'Loan Balance', 'Cumulative'].map((h) => (
                <th key={h} className={`px-4 py-2 font-medium ${h === 'Month' ? 'text-left' : 'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-[var(--border-color)]/40 hover:bg-[var(--bg-elevated)]/50 ${
                  i === debtFreeIdx ? 'bg-teal-950/25 ring-1 ring-inset ring-teal-500/30' :
                  i === trueBreakevenIdx ? 'bg-amber-950/25 ring-1 ring-inset ring-amber-500/30' : ''
                }`}
              >
                <td className="px-4 py-2 font-medium whitespace-nowrap">
                  {row.label}
                  {i === debtFreeIdx && (
                    <span className="ml-2 text-[10px] font-semibold text-teal-400 bg-teal-950/60 px-1.5 py-0.5 rounded">
                      DEBT FREE
                    </span>
                  )}
                  {i === trueBreakevenIdx && i !== debtFreeIdx && (
                    <span className="ml-2 text-[10px] font-semibold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded">
                      BREAKEVEN
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--accent)]">{fmt(row.revenue)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-orange-400">{fmt(row.expenses)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-rose-400">{row.emi > 0 ? fmt(row.emi) : '—'}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-medium ${row.net >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>
                  {row.net >= 0 ? '+' : ''}{fmt(row.net)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--text-secondary)]">
                  {row.loanBalance > 0 ? fmt(row.loanBalance) : '—'}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums ${row.cumulative >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                  {fmt(row.cumulative)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
