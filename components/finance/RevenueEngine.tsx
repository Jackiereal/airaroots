'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

type RevItem = {
  id: string;
  source: string;
  amount: number;
  revenue_date: string;
  period_month: string;
  notes: string | null;
};

type AllItem = {
  source: string;
  label: string;
  monthlyAmount: number;
  annualAmount: number;
  growthPct: number | null;
  contributionPct: number;
  isManual: boolean;
};

const SOURCE_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  direct: 'Direct Booking',
  corporate: 'Corporate Events',
  birthday: 'Birthday Parties',
  photography: 'Photography Shoots',
  workshop: 'Workshops',
  day_outing: 'Day Outings',
  bbq: 'BBQ Packages',
  breakfast: 'Breakfast',
  extra_guest: 'Extra Guest Charges',
  cleaning_fee: 'Cleaning Fee',
  late_checkout: 'Late Checkout',
  early_checkin: 'Early Check-in',
  security_deposit: 'Security Deposit',
  gift_voucher: 'Gift Vouchers',
  other: 'Other',
};

const MANUAL_SOURCES = Object.keys(SOURCE_LABELS).filter((s) => s !== 'airbnb' && s !== 'direct');

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function AddItemForm({
  month,
  onSave,
  onCancel,
  saving,
  initial,
}: {
  month: string;
  onSave: (d: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
  initial?: Partial<RevItem>;
}) {
  const [source, setSource] = useState(initial?.source ?? 'bbq');
  const [amount, setAmount] = useState(String(initial?.amount ?? ''));
  const [date, setDate] = useState(initial?.revenue_date ?? month + '-01');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ source, amount: Number(amount), revenue_date: date, period_month: month, notes: notes || null });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Revenue Source *</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            {MANUAL_SOURCES.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Amount (₹) *</label>
          <input
            type="number"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Date *</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </form>
  );
}

export default function RevenueEngine({ month, propertyId }: { month: string; propertyId: string }) {
  const [items, setItems] = useState<RevItem[]>([]);
  const [dashData, setDashData] = useState<{
    revBySource: Record<string, number>;
    annualRevenue: number;
  } | null>(null);
  const [annualBySource, setAnnualBySource] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<RevItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, dashRes, allItemsRes] = await Promise.all([
        fetch(`/api/finance/${propertyId}/direct-bookings?month=${month}`),
        fetch(`/api/finance/${propertyId}/summary?month=${month}`),
        fetch('/api/finance/${propertyId}/direct-bookings?all=1'),
      ]);
      const [itemsJson, dashJson, allJson] = await Promise.all([
        itemsRes.json(),
        dashRes.json(),
        allItemsRes.json(),
      ]);
      setItems(itemsJson.items ?? []);
      setDashData({ revBySource: dashJson.revBySource ?? {}, annualRevenue: dashJson.annualRevenue ?? 0 });

      const currentYear = month.slice(0, 4);
      const aBySource: Record<string, number> = {};
      for (const item of (allJson.items ?? []) as RevItem[]) {
        if (item.period_month.startsWith(currentYear)) {
          aBySource[item.source] = (aBySource[item.source] ?? 0) + item.amount;
        }
      }
      setAnnualBySource(aBySource);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  async function saveItem(data: Record<string, unknown>) {
    setSaving(true);
    try {
      const url = editItem ? `/api/finance/${propertyId}/direct-bookings/${editItem.id}` : '/api/finance/${propertyId}/direct-bookings';
      const method = editItem ? 'PATCH' : 'POST';
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      setDialogOpen(false);
      setEditItem(null);
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this revenue item?')) return;
    await fetch(`/api/finance/${propertyId}/direct-bookings/${id}`, { method: 'DELETE' });
    void load();
  }

  const revBySource = dashData?.revBySource ?? {};
  const totalMonthly = Object.values(revBySource).reduce((s, v) => s + v, 0);

  const allSources = Object.keys(SOURCE_LABELS).filter(
    (s) => (revBySource[s] ?? 0) > 0 || annualBySource[s]
  );

  const rows: AllItem[] = allSources.map((src) => ({
    source: src,
    label: SOURCE_LABELS[src] ?? src,
    monthlyAmount: revBySource[src] ?? 0,
    annualAmount: annualBySource[src] ?? (src === 'airbnb' || src === 'direct' ? (revBySource[src] ?? 0) * 12 : 0),
    growthPct: null,
    contributionPct: totalMonthly > 0 ? ((revBySource[src] ?? 0) / totalMonthly) * 100 : 0,
    isManual: src !== 'airbnb' && src !== 'direct',
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            Revenue Engine
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">All revenue sources for {month}. Airbnb + Direct auto-calculated.</p>
        </div>
        <Dialog.Root open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditItem(null); }}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Add Revenue
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-base)] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">
                  {editItem ? 'Edit Revenue Item' : 'Add Revenue Item'}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
              <AddItemForm
                month={month}
                initial={editItem ?? undefined}
                onSave={saveItem}
                onCancel={() => { setDialogOpen(false); setEditItem(null); }}
                saving={saving}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading revenue data...
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
            <table className="w-full text-sm text-[var(--text-primary)]">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-elevated)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Source</th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]">This Month</th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]">Annual (YTD)</th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]">Contribution</th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">No revenue data for {month}.</td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.source} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-elevated)]/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{row.label}</span>
                        {!row.isManual && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">auto</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--accent)] font-medium">
                      {row.monthlyAmount > 0 ? fmt(row.monthlyAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.annualAmount > 0 ? fmt(row.annualAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {row.contributionPct > 0 ? `${row.contributionPct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.isManual && (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const item = items.find((i) => i.source === row.source);
                              if (item) { setEditItem(item); setDialogOpen(true); }
                            }}
                            className="rounded p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const item = items.find((i) => i.source === row.source);
                              if (item) deleteItem(item.id);
                            }}
                            className="rounded p-1 text-[var(--text-secondary)] hover:text-rose-300 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="bg-[var(--bg-elevated)]/50 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--accent)]">{fmt(totalMonthly)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(dashData?.annualRevenue ?? 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">100%</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {items.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Manual entries this month</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
                    <div>
                      <span className="text-sm text-[var(--text-primary)]">{SOURCE_LABELS[item.source] ?? item.source}</span>
                      {item.notes && <span className="ml-2 text-xs text-[var(--text-secondary)]">{item.notes}</span>}
                      <span className="ml-2 text-xs text-[var(--text-secondary)]">{item.revenue_date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--accent)]">{fmt(item.amount)}</span>
                      <button
                        type="button"
                        onClick={() => { setEditItem(item); setDialogOpen(true); }}
                        className="rounded p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        className="rounded p-1 text-[var(--text-secondary)] hover:text-rose-300 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
