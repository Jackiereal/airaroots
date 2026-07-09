'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import Picker from '@/components/ui/Picker';
import { ResponsiveTable, TableCard } from '@/components/ui/ResponsiveTable';

type Loan = {
  id: string;
  name: string;
  loan_type: string;
  principal: number;
  interest_rate: number;
  start_date: string;
  tenure_months: number;
  processing_fee: number;
  insurance_amount: number;
  emi_override: number | null;
  prepayment_penalty_pct: number;
  allow_extra_payments: boolean;
  notes: string | null;
  is_active: boolean;
  computed_emi?: number;
};

type ScheduleRow = {
  month: number;
  date: string;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  extraPayment: number;
  closingBalance: number;
};

type LoanScheduleData = {
  schedule: { emi: number; totalPayable: number; totalInterest: number; debtFreeDate: string; rows: ScheduleRow[] };
  summary: {
    emi: number;
    outstandingPrincipal: number;
    principalPaid: number;
    interestPaid: number;
    remainingInterest: number;
    totalInterest: number;
    debtFreeDate: string;
  };
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  gold: 'Gold Loan',
  personal: 'Personal Loan',
  business: 'Business Loan',
  home: 'Home Loan',
  partner: 'Partner Loan',
};

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtD(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const EMPTY_FORM = {
  name: '',
  loan_type: 'personal',
  principal: '',
  interest_rate: '',
  start_date: new Date().toISOString().slice(0, 10),
  tenure_months: '',
  processing_fee: '',
  insurance_amount: '',
  emi_override: '',
  prepayment_penalty_pct: '',
  allow_extra_payments: true,
  notes: '',
};

function LoanForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<typeof EMPTY_FORM & { id: string }>;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });

  function set(k: string, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name: form.name,
      loan_type: form.loan_type,
      principal: Number(form.principal),
      interest_rate: Number(form.interest_rate),
      start_date: form.start_date,
      tenure_months: Number(form.tenure_months),
      processing_fee: form.processing_fee ? Number(form.processing_fee) : 0,
      insurance_amount: form.insurance_amount ? Number(form.insurance_amount) : 0,
      emi_override: form.emi_override ? Number(form.emi_override) : null,
      prepayment_penalty_pct: form.prepayment_penalty_pct ? Number(form.prepayment_penalty_pct) : 0,
      allow_extra_payments: form.allow_extra_payments,
      notes: form.notes || null,
    });
  }

  const field = (label: string, key: string, type = 'text', required = false, placeholder = '') => (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}{required && ' *'}</label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={String((form as Record<string, unknown>)[key] ?? '')}
        onChange={(e) => set(key, e.target.value)}
        className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('Loan Name', 'name', 'text', true, 'e.g. Gold Loan SBI')}
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Loan Type *</label>
          <Picker
            value={form.loan_type}
            onChange={(v) => set('loan_type', v)}
            options={Object.entries(LOAN_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            className="w-full"
          />
        </div>
        {field('Principal (₹)', 'principal', 'number', true, '500000')}
        {field('Annual Interest Rate (%)', 'interest_rate', 'number', true, '12.5')}
        {field('Start Date', 'start_date', 'date', true)}
        {field('Tenure (months)', 'tenure_months', 'number', true, '24')}
        {field('Processing Fee (₹)', 'processing_fee', 'number', false, '0')}
        {field('Insurance (₹)', 'insurance_amount', 'number', false, '0')}
        {field('EMI Override (₹, leave blank to auto-calc)', 'emi_override', 'number', false)}
        {field('Prepayment Penalty (%)', 'prepayment_penalty_pct', 'number', false, '0')}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="allow_extra"
          checked={form.allow_extra_payments}
          onChange={(e) => set('allow_extra_payments', e.target.checked)}
          className="rounded"
        />
        <label htmlFor="allow_extra" className="text-sm text-[var(--text-secondary)]">Allow extra payments</label>
      </div>
      <div>
        <label className="block text-xs text-[var(--text-secondary)] mb-1">Notes</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] resize-none"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save Loan
        </button>
      </div>
    </form>
  );
}

function AmortizationTable({ data }: { data: LoanScheduleData }) {
  const [show, setShow] = useState(false);
  const { schedule, summary } = data;

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'EMI', value: fmt(summary.emi) },
          { label: 'Outstanding', value: fmt(summary.outstandingPrincipal), cls: 'text-rose-200' },
          { label: 'Interest Paid', value: fmt(summary.interestPaid), cls: 'text-amber-200' },
          { label: 'Principal Paid', value: fmt(summary.principalPaid), cls: 'text-teal-200' },
          { label: 'Remaining Interest', value: fmt(summary.remainingInterest), cls: 'text-orange-200' },
          { label: 'Total Interest', value: fmt(summary.totalInterest), cls: 'text-rose-200/70' },
          { label: 'Debt-Free Date', value: fmtD(summary.debtFreeDate) },
          { label: 'Total Payable', value: fmt(schedule.totalPayable) },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">{m.label}</p>
            <p className={['text-sm font-semibold mt-0.5', m.cls ?? 'text-[var(--text-primary)]'].join(' ')}>{m.value}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        {show ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {show ? 'Hide' : 'Show'} amortization schedule ({schedule.rows.length} months)
      </button>
      {show && (
        <ResponsiveTable
          table={
            <div className="overflow-x-auto overscroll-x-contain touch-pan-x rounded-xl border border-[var(--border-color)]">
              <table className="w-full min-w-[44rem] text-xs text-[var(--text-primary)]">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-elevated)]">
                    {['#', 'Date', 'Opening', 'EMI', 'Principal', 'Interest', 'Extra', 'Closing'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedule.rows.map((row) => (
                    <tr key={row.month} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-elevated)]/50">
                      <td className="px-3 py-1.5 tabular-nums text-[var(--text-secondary)]">{row.month}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fmtD(row.date)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fmt(row.openingBalance)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fmt(row.emi)}</td>
                      <td className="px-3 py-1.5 tabular-nums text-teal-200">{fmt(row.principal)}</td>
                      <td className="px-3 py-1.5 tabular-nums text-amber-200">{fmt(row.interest)}</td>
                      <td className="px-3 py-1.5 tabular-nums text-[var(--accent)]">{row.extraPayment > 0 ? fmt(row.extraPayment) : '—'}</td>
                      <td className="px-3 py-1.5 tabular-nums font-medium">{fmt(row.closingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
          cards={
            <div className="space-y-3">
              {schedule.rows.map((row) => (
                <TableCard
                  key={row.month}
                  title={
                    <span className="font-medium text-sm text-[var(--text-primary)]">
                      Month {row.month}
                      <span className="block text-xs text-[var(--text-tertiary)] font-normal">{fmtD(row.date)}</span>
                    </span>
                  }
                  titleExtra={<span className="font-medium text-sm text-[var(--text-primary)]">{fmt(row.closingBalance)}</span>}
                  fields={[
                    { label: 'Opening', value: fmt(row.openingBalance) },
                    { label: 'EMI', value: fmt(row.emi) },
                    { label: 'Principal', value: <span className="text-teal-400">{fmt(row.principal)}</span> },
                    { label: 'Interest', value: <span className="text-amber-400">{fmt(row.interest)}</span> },
                    { label: 'Extra', value: row.extraPayment > 0 ? <span className="text-[var(--accent)]">{fmt(row.extraPayment)}</span> : '—' },
                  ]}
                />
              ))}
            </div>
          }
        />
      )}
    </div>
  );
}

function LoanCard({
  loan,
  propertyId,
  onEdit,
  onDelete,
}: {
  loan: Loan;
  propertyId: string;
  onEdit: (loan: Loan) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [scheduleData, setScheduleData] = useState<LoanScheduleData | null>(null);
  const [loadingSched, setLoadingSched] = useState(false);
  const [extraAmount, setExtraAmount] = useState('');
  const [addingPayment, setAddingPayment] = useState(false);

  async function loadSchedule() {
    if (scheduleData) { setExpanded((e) => !e); return; }
    setExpanded(true);
    setLoadingSched(true);
    try {
      const res = await fetch(`/api/finance/${propertyId}/loans/${loan.id}/schedule`);
      const json = await res.json();
      setScheduleData(json);
    } finally {
      setLoadingSched(false);
    }
  }

  async function addExtraPayment() {
    const amt = Number(extraAmount);
    if (!amt || amt <= 0) return;
    setAddingPayment(true);
    try {
      await fetch(`/api/finance/${propertyId}/loans/${loan.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: new Date().toISOString().slice(0, 10),
          amount: amt,
          payment_type: 'extra',
        }),
      });
      setExtraAmount('');
      setScheduleData(null);
      setExpanded(false);
    } finally {
      setAddingPayment(false);
    }
  }

  const emi = loan.computed_emi ?? loan.emi_override ?? 0;

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-[var(--text-primary)]">{loan.name}</span>
            <span className="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
              {LOAN_TYPE_LABELS[loan.loan_type] ?? loan.loan_type}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
            <span className="text-[var(--text-secondary)]">Principal: <span className="text-[var(--text-primary)] font-medium">{fmt(loan.principal)}</span></span>
            <span className="text-[var(--text-secondary)]">Rate: <span className="text-[var(--text-primary)] font-medium">{loan.interest_rate}%</span></span>
            <span className="text-[var(--text-secondary)]">EMI: <span className="text-[var(--accent)] font-semibold">{fmt(emi)}</span></span>
            <span className="text-[var(--text-secondary)]">Tenure: <span className="text-[var(--text-primary)]">{loan.tenure_months} mo</span></span>
            <span className="text-[var(--text-secondary)]">Start: <span className="text-[var(--text-primary)]">{fmtD(loan.start_date)}</span></span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(loan)}
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(loan.id)}
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={loadSchedule}
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {loan.allow_extra_payments && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            value={extraAmount}
            onChange={(e) => setExtraAmount(e.target.value)}
            placeholder="Extra payment amount (₹)"
            className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={addExtraPayment}
            disabled={addingPayment || !extraAmount}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 px-3 py-1.5 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/25 disabled:opacity-50 transition-colors"
          >
            {addingPayment && <Loader2 className="h-3 w-3 animate-spin" />}
            Pay Extra
          </button>
        </div>
      )}

      {expanded && (
        <div className="mt-3">
          {loadingSched ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading schedule...
            </div>
          ) : scheduleData ? (
            <AmortizationTable data={scheduleData} />
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function LoanManager({ propertyId }: { propertyId: string }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/${propertyId}/loans');
      const json = await res.json();
      setLoans(json.loans ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLoans(); }, [loadLoans]);

  async function saveLoan(data: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const url = editLoan ? `/api/finance/${propertyId}/loans/${editLoan.id}` : '/api/finance/${propertyId}/loans';
      const method = editLoan ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed to save'); return; }
      setDialogOpen(false);
      setEditLoan(null);
      void loadLoans();
    } finally {
      setSaving(false);
    }
  }

  async function deleteLoan(id: string) {
    if (!confirm('Delete this loan? This cannot be undone.')) return;
    await fetch(`/api/finance/${propertyId}/loans/${id}`, { method: 'DELETE' });
    void loadLoans();
  }

  const totalOutstanding = loans.reduce((s, l) => s + (l.computed_emi ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            Loan Manager
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">Track all loans, EMIs, and debt-free timelines.</p>
        </div>
        <Dialog.Root open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditLoan(null); }}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Add Loan
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">
                  {editLoan ? 'Edit Loan' : 'Add Loan'}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
              {error && <p className="mb-3 rounded-lg bg-rose-950/40 border border-rose-500/30 px-3 py-2 text-sm text-rose-200">{error}</p>}
              <LoanForm
                initial={editLoan ? {
                  name: editLoan.name,
                  loan_type: editLoan.loan_type,
                  principal: String(editLoan.principal),
                  interest_rate: String(editLoan.interest_rate),
                  start_date: editLoan.start_date,
                  tenure_months: String(editLoan.tenure_months),
                  processing_fee: String(editLoan.processing_fee),
                  insurance_amount: String(editLoan.insurance_amount),
                  emi_override: editLoan.emi_override ? String(editLoan.emi_override) : '',
                  prepayment_penalty_pct: String(editLoan.prepayment_penalty_pct),
                  allow_extra_payments: editLoan.allow_extra_payments,
                  notes: editLoan.notes ?? '',
                } : undefined}
                onSave={saveLoan}
                onCancel={() => { setDialogOpen(false); setEditLoan(null); }}
                saving={saving}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading loans...
        </div>
      ) : loans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-12 text-center">
          <p className="text-[var(--text-secondary)] text-sm">No loans yet.</p>
          <p className="text-[var(--text-secondary)] text-xs mt-1">Add your first loan to track EMIs and debt-free date.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loans.length > 1 && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">Total monthly EMI across {loans.length} loans</span>
              <span className="text-base font-semibold text-rose-200">{fmt(totalOutstanding)}</span>
            </div>
          )}
          {loans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              propertyId={propertyId}
              onEdit={(l) => { setEditLoan(l); setDialogOpen(true); }}
              onDelete={deleteLoan}
            />
          ))}
        </div>
      )}
    </div>
  );
}
