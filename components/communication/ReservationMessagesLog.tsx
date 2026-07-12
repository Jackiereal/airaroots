'use client';

import { useEffect, useState } from 'react';
import type { CommunicationLogEntry } from '@/src/domains/communication/types';
import { TRIGGER_LABELS } from '@/src/domains/communication/constants';
import type { CommunicationTrigger } from '@/src/domains/communication/types';

const STATUS_STYLE: Record<string, string> = {
  stubbed: 'text-[var(--text-tertiary)] border-[var(--border-color)]',
  sent: 'text-[var(--color-green)] border-[var(--color-green)]',
  failed: 'text-[var(--color-red)] border-[var(--color-red)]',
  skipped: 'text-[var(--text-tertiary)] border-[var(--border-color)]',
};

const STATUS_LABEL: Record<string, string> = {
  stubbed: 'Logged (not sent)',
  sent: 'Sent',
  failed: 'Failed',
  skipped: 'Skipped',
};

export function ReservationMessagesLog({ reservationId }: { reservationId: string }) {
  const [log, setLog] = useState<CommunicationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reservations/${reservationId}/communication`)
      .then((r) => r.json())
      .then((d) => setLog(d.log ?? []))
      .catch(() => setLog([]))
      .finally(() => setLoading(false));
  }, [reservationId]);

  if (loading) return null;

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:col-span-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Messages</h2>
      {log.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No guest messages yet.</p>
      ) : (
        <div className="space-y-3">
          {log.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)]">
                  {TRIGGER_LABELS[e.trigger as CommunicationTrigger] ?? e.trigger}
                  <span className="text-[var(--text-tertiary)]"> · {e.channel}</span>
                </p>
                {e.renderedBody && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{e.renderedBody}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${STATUS_STYLE[e.status] ?? ''}`}
              >
                {STATUS_LABEL[e.status] ?? e.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
