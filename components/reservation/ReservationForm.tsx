'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2 } from 'lucide-react';
import type { CreateReservationInput } from '@/src/domains/reservation/schema';

type Property = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  properties: Property[];
  defaultPropertyId?: string;
  defaultCheckIn?: string;
  onSuccess?: () => void;
};

const CHANNELS = [
  { value: 'direct', label: 'Direct' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'vrbo', label: 'VRBO' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'other', label: 'Other' },
] as const;

export function ReservationForm({ open, onClose, properties, defaultPropertyId, defaultCheckIn, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    propertyId: defaultPropertyId ?? properties[0]?.id ?? '',
    channel: 'direct' as CreateReservationInput['channel'],
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkIn: defaultCheckIn ?? '',
    checkOut: '',
    adults: 1,
    children: 0,
    nightlyRate: '',
    cleaningFee: '',
    notes: '',
  });

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        propertyId: form.propertyId,
        channel: form.channel,
        guestName: form.guestName || undefined,
        guestEmail: form.guestEmail || undefined,
        guestPhone: form.guestPhone || undefined,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        adults: form.adults,
        children: form.children,
        nightlyRate: parseFloat(form.nightlyRate) || 0,
        cleaningFee: parseFloat(form.cleaningFee) || 0,
        notes: form.notes || undefined,
      };

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create reservation');
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
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-[var(--bg-base)] rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
            <Dialog.Title className="text-base font-semibold">New Reservation</Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Property */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Property</label>
              <select
                value={form.propertyId}
                onChange={(e) => set('propertyId', e.target.value)}
                required
                className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Channel */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => set('channel', e.target.value as CreateReservationInput['channel'])}
                className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Guest info */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Guest name</label>
                <input
                  type="text"
                  value={form.guestName}
                  onChange={(e) => set('guestName', e.target.value)}
                  placeholder="Full name"
                  className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.guestEmail}
                    onChange={(e) => set('guestEmail', e.target.value)}
                    placeholder="Optional"
                    className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={form.guestPhone}
                    onChange={(e) => set('guestPhone', e.target.value)}
                    placeholder="Optional"
                    className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Check-in</label>
                <input
                  type="date"
                  value={form.checkIn}
                  onChange={(e) => set('checkIn', e.target.value)}
                  required
                  className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Check-out</label>
                <input
                  type="date"
                  value={form.checkOut}
                  onChange={(e) => set('checkOut', e.target.value)}
                  required
                  min={form.checkIn}
                  className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Guests */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Adults</label>
                <input
                  type="number"
                  value={form.adults}
                  onChange={(e) => set('adults', parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Children</label>
                <input
                  type="number"
                  value={form.children}
                  onChange={(e) => set('children', parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Rates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Nightly rate (₹)</label>
                <input
                  type="number"
                  value={form.nightlyRate}
                  onChange={(e) => set('nightlyRate', e.target.value)}
                  required
                  min={0}
                  placeholder="0"
                  className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Cleaning fee (₹)</label>
                <input
                  type="number"
                  value={form.cleaningFee}
                  onChange={(e) => set('cleaningFee', e.target.value)}
                  min={0}
                  placeholder="0"
                  className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={3}
                placeholder="Internal notes..."
                className="w-full border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-red)] bg-[var(--color-red-muted)] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
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
                Create Reservation
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
