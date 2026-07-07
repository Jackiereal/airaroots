'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  propertyId: string;
  defaultDate?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

const BLOCK_TYPES = [
  { value: 'owner_hold', label: 'Owner Hold' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'buffer', label: 'Buffer / Turnaround' },
  { value: 'seasonal_close', label: 'Seasonal Close' },
] as const;

export function BlockDateModal({ open, propertyId, defaultDate, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    blockType: 'owner_hold' as 'owner_hold' | 'maintenance' | 'buffer' | 'seasonal_close',
    startDate: defaultDate ?? '',
    endDate: defaultDate ?? '',
    reason: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/properties/${propertyId}/calendar/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create block');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-[var(--bg-base)] rounded-xl shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
            <Dialog.Title className="text-base font-semibold">Block Dates</Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Block type</label>
              <select
                value={form.blockType}
                onChange={(e) => set('blockType', e.target.value)}
                className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                {BLOCK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Start date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  required
                  className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">End date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  required
                  min={form.startDate}
                  className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => set('reason', e.target.value)}
                placeholder="e.g. Owner vacation, Repairs..."
                maxLength={500}
                className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-red)] bg-[var(--color-red-muted)] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border-color)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Block Dates
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
