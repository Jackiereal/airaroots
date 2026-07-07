'use client';

import type { ReservationStatus } from '@/src/domains/reservation/types';

const STATUS_CONFIG: Record<ReservationStatus, { label: string; className: string }> = {
  inquiry:      { label: 'Inquiry',     className: 'bg-[var(--color-blue-muted)] text-[var(--color-blue)]' },
  confirmed:    { label: 'Confirmed',   className: 'bg-[var(--accent-muted)] text-[var(--accent)]' },
  checked_in:   { label: 'Checked In',  className: 'bg-[var(--accent)] text-white' },
  checked_out:  { label: 'Checked Out', className: 'bg-[var(--bg-surface)] text-[var(--text-secondary)]' },
  cancelled:    { label: 'Cancelled',   className: 'bg-[var(--color-red-muted)] text-[var(--color-red)]' },
  no_show:      { label: 'No Show',     className: 'bg-[var(--color-amber-muted)] text-[var(--color-amber)]' },
  conflict:     { label: 'Conflict',    className: 'bg-[var(--color-red)] text-white' },
};

type Props = {
  status: ReservationStatus;
  size?: 'sm' | 'md';
};

export function ReservationStatusBadge({ status, size = 'md' }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.confirmed;
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${config.className}`}>
      {config.label}
    </span>
  );
}
