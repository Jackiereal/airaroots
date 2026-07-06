'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildSchedule, calcEmi } from '@/lib/finance/loan-calc';

type Loan = {
  id: string;
  name: string;
  loan_type: string;
  principal: number;
  interest_rate: number;
  start_date: string;
  tenure_months: number;
  emi_override: number | null;
  is_active: boolean;
};

function fmt(n: number) {
  return '₹' + (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function monthsBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

function LoanPlanner({ loan }: { loan: Loan }) {
  const [extraMonthly, setExtraMonthly] = useState(0);

  const baseline = useMemo(() => buildSchedule({
    principal: loan.principal,
    annualRate: loan.interest_rate,
    tenureMonths: loan.tenure_months,
    startDate: loan.start_date,
    emiOverride: loan.emi_override,
  }), [loan]);

  const withExtra = useMemo(() => {
    if (extraMonthly === 0) return baseline;
    const today = new Date().toISOString().slice(0, 10);
    const syntheticPayments: { payment_date: string; amount: number; payment_type: string }[] = [];
    for (let i = 0; i < loan.tenure_months + 60; i++) {
      const d = new Date(loan.start_date);
      d.setMonth(d.getMonth() + i);
      if (d.toISOString().slice(0, 10) >= today) {
        syntheticPayments.push({ payment_date: d.toISOString().slice(0, 10), amount: extraMonthly, payment_type: 'extra' });
      }
    }
    return buildSchedule({
      principal: loan.principal,
      annualRate: loan.interest_rate,
      tenureMonths: loan.tenure_months,
      startDate: loan.start_date,
      emiOverride: loan.emi_override,
      extraPayments: syntheticPayments,
    });
  }, [loan, extraMonthly, baseline]);

  const monthsSaved = monthsBetween(withExtra.debtFreeDate, baseline.debtFreeDate);
  const interestSaved = Math.round(baseline.totalInterest - withExtra.totalInterest);
  const emi = loan.emi_override ?? calcEmi(loan.principal, loan.interest_rate, loan.tenure_months);

  // Chart: sample every 3rd row to keep data size reasonable
  const step = Math.max(1, Math.floor(baseline.rows.length / 30));
  const chartData = baseline.rows
    .filter((_, i) => i % step === 0)
    .map((row) => {
      const extraRow = withExtra.rows[row.month - 1];
      return {
        month: row.date.slice(0, 7),
        Baseline: row.closingBalance,
        'With Extra': extraRow?.closingBalance ?? 0,
      };
    });

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-4">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <p className="font-medium text-[var(--text-primary)] capitalize">{loan.name}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{loan.loan_type} · EMI {fmt(Math.round(emi))} · {loan.tenure_months} months</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text-secondary)]">Debt-free date</p>
          <p className="text-sm font-semibold text-[var(--accent)]">
            {new Date(baseline.debtFreeDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Extra payment slider */}
      <div>
        <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
          <span>Extra Monthly Payment</span>
          <span className="font-medium text-[var(--text-primary)]">{fmt(extraMonthly)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={50000}
          step={500}
          value={extraMonthly}
          onChange={(e) => setExtraMonthly(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-0.5">
          <span>₹0</span>
          <span>₹50,000</span>
        </div>
      </div>

      {/* Impact */}
      {extraMonthly > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-teal-500/40 bg-teal-950/30 p-2 text-center">
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">Months Saved</p>
            <p className="text-lg font-bold text-teal-200">{monthsSaved}</p>
          </div>
          <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-2 text-center">
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">Interest Saved</p>
            <p className="text-lg font-bold text-[var(--accent)]">{fmt(interestSaved)}</p>
          </div>
          <div className="rounded-lg border border-sky-500/40 bg-sky-950/30 p-2 text-center">
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">New Debt-Free</p>
            <p className="text-sm font-bold text-sky-200">
              {new Date(withExtra.debtFreeDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
          <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Baseline" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 2" />
          {extraMonthly > 0 && <Line type="monotone" dataKey="With Extra" stroke="var(--accent)" strokeWidth={2} dot={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DebtFreePlanner({ propertyId }: { propertyId: string }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/finance/${propertyId}/loans')
      .then((r) => r.json())
      .then((d) => setLoans((d.loans ?? []).filter((l: Loan) => l.is_active)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading loans...
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">No active loans. Add loans in the Loans tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Drag slider to simulate extra monthly payment — see how much faster you go debt-free.
      </p>
      {loans.map((loan) => (
        <LoanPlanner key={loan.id} loan={loan} />
      ))}
    </div>
  );
}
