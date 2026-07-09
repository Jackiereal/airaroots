'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReservationStatus } from '@/src/domains/reservation/types';

type Props = {
  reservationId: string;
  status: ReservationStatus;
};

export function ReservationActions({ reservationId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: 'check-in' | 'check-out' | 'cancel') => {
    setLoading(true);
    try {
      const body = action === 'cancel' ? { reason: 'Cancelled via dashboard' } : {};
      const res = await fetch(`/api/reservations/${reservationId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  if (status !== 'confirmed' && status !== 'checked_in') return null;

  return (
    <div className="flex gap-2 mb-6">
      {status === 'confirmed' && (
        <button
          onClick={() => handleAction('check-in')}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Check In
        </button>
      )}
      {status === 'checked_in' && (
        <button
          onClick={() => handleAction('check-out')}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Check Out
        </button>
      )}
      <button
        onClick={() => handleAction('cancel')}
        disabled={loading}
        className="px-4 py-2 rounded-lg border border-[var(--color-red)] text-[var(--color-red)] text-sm font-medium hover:bg-[var(--color-red-muted)] disabled:opacity-50 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
