'use client';

import type { Reservation } from '@/src/domains/reservation/types';
import { CHANNEL_COLORS } from '@/src/domains/reservation/constants';

type Props = {
  reservation: Reservation;
  onClick: () => void;
};

export function ReservationCard({ reservation, onClick }: Props) {
  const color = CHANNEL_COLORS[reservation.channel] ?? CHANNEL_COLORS['other'];

  return (
    <button
      onClick={onClick}
      className="absolute inset-y-1 rounded flex items-center px-2 overflow-hidden text-white text-xs font-medium cursor-pointer hover:brightness-90 transition-all z-10 select-none"
      style={{
        backgroundColor: color,
        left: 'var(--block-left)',
        right: 'var(--block-right)',
        minWidth: '2px',
      }}
      title={`${reservation.guestName ?? 'Guest'} · ${reservation.checkIn} – ${reservation.checkOut}`}
    >
      <span className="truncate">{reservation.guestName ?? 'Guest'}</span>
    </button>
  );
}
