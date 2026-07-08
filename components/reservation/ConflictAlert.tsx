'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { Reservation } from '@/src/domains/reservation/types';
import { CHANNEL_LABELS } from '@/src/domains/reservation/constants';

type Props = {
  reservationId: string;
  onResolved: () => void;
};

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtAmount(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function ConflictAlert({ reservationId, onResolved }: Props) {
  const [conflicts, setConflicts] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reservations/${reservationId}/conflicts`)
      .then(r => r.json())
      .then(d => setConflicts(d.conflicts ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [reservationId]);

  async function resolve(
    action: 'cancel_this' | 'cancel_conflicting' | 'mark_resolved',
    conflictingId?: string
  ) {
    setResolving(action + (conflictingId ?? ''));
    try {
      const res = await fetch(`/api/reservations/${reservationId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, conflictingId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? 'Failed to resolve conflict');
        return;
      }
      onResolved();
    } finally {
      setResolving(null);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-[var(--color-amber)] bg-[var(--color-amber-muted)] p-5 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-[var(--color-amber)] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Booking Conflict</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            This reservation overlaps with {conflicts.length > 0 ? `${conflicts.length} other booking${conflicts.length > 1 ? 's' : ''}` : 'another booking'}.
            Choose how to resolve it.
          </p>

          {conflicts.length > 0 && (
            <div className="space-y-3 mb-4">
              {conflicts.map(c => (
                <div
                  key={c.id}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-[var(--text-primary)] text-sm">
                        {c.guestName ?? 'Unknown guest'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {fmt(c.checkIn)} → {fmt(c.checkOut)} · {c.nights} nights · {CHANNEL_LABELS[c.channel] ?? c.channel}
                      </p>
                      {c.grossRevenue > 0 && (
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {fmtAmount(c.grossRevenue)} gross
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => resolve('cancel_conflicting', c.id)}
                      disabled={resolving !== null}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[var(--color-red)] text-[var(--color-red)] hover:bg-[var(--color-red-muted)] disabled:opacity-50 transition-colors"
                    >
                      {resolving === 'cancel_conflicting' + c.id ? 'Cancelling…' : 'Cancel this one'}
                    </button>
                  </div>
                  {(c.channel === 'airbnb' || c.channel === 'booking_com' || c.channel === 'vrbo') && (
                    <p className="text-xs text-[var(--color-amber)] mt-2">
                      Remember to also cancel on {CHANNEL_LABELS[c.channel]} manually.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => resolve('cancel_this')}
              disabled={resolving !== null}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-red)] text-[var(--color-red)] hover:bg-[var(--color-red-muted)] disabled:opacity-50 transition-colors"
            >
              {resolving === 'cancel_this' ? 'Cancelling…' : 'Cancel this reservation'}
            </button>
            <button
              onClick={() => resolve('mark_resolved')}
              disabled={resolving !== null}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-50 transition-colors"
            >
              {resolving === 'mark_resolved' ? 'Saving…' : 'Mark as resolved (handled externally)'}
            </button>
          </div>
        </div>
        <X size={16} className="text-[var(--text-tertiary)] shrink-0 cursor-default" />
      </div>
    </div>
  );
}
