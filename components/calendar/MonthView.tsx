'use client';

import { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth } from 'date-fns';
import type { Reservation } from '@/src/domains/reservation/types';
import type { CalendarBlock } from '@/src/domains/calendar/types';
import { CHANNEL_COLORS } from '@/src/domains/reservation/constants';

type Props = {
  month: Date;
  reservations: Reservation[];
  blocks: CalendarBlock[];
  onReservationClick: (reservation: Reservation) => void;
  onDateClick: (date: string) => void;
};

const BLOCK_COLORS: Record<string, string> = {
  owner_hold:     '#6b7280',
  maintenance:    '#f59e0b',
  buffer:         '#d1d5db',
  seasonal_close: '#9ca3af',
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MonthView({ month, reservations, blocks, onReservationClick, onDateClick }: Props) {
  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    const weeks: Date[][] = [];
    let current = start;
    while (current <= end) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(current);
        current = addDays(current, 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [month]);

  // Index reservations by date they cover
  const resByDate = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      let d = new Date(r.checkIn + 'T00:00:00');
      const end = new Date(r.checkOut + 'T00:00:00');
      while (d < end) {
        const key = format(d, 'yyyy-MM-dd');
        const list = map.get(key) ?? [];
        list.push(r);
        map.set(key, list);
        d = addDays(d, 1);
      }
    }
    return map;
  }, [reservations]);

  // Index manual blocks by date
  const blocksByDate = useMemo(() => {
    const map = new Map<string, CalendarBlock[]>();
    for (const b of blocks) {
      if (b.blockType === 'reservation') continue;
      let d = new Date(b.startDate + 'T00:00:00');
      const end = new Date(b.endDate + 'T00:00:00');
      while (d <= end) {
        const key = format(d, 'yyyy-MM-dd');
        const list = map.get(key) ?? [];
        list.push(b);
        map.set(key, list);
        d = addDays(d, 1);
      }
    }
    return map;
  }, [blocks]);

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="w-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[var(--border-color)]">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-[var(--text-tertiary)] py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-[var(--border-color)]">
          {week.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isCurrentMonth = isSameMonth(day, month);
            const isToday = dateStr === today;
            const dayReservations = resByDate.get(dateStr) ?? [];
            const dayBlocks = blocksByDate.get(dateStr) ?? [];

            return (
              <div
                key={dateStr}
                onClick={() => onDateClick(dateStr)}
                className={`min-h-[80px] p-1.5 border-r border-[var(--border-color)] cursor-pointer transition-colors hover:bg-[var(--accent-muted)]/30 ${
                  !isCurrentMonth ? 'bg-[var(--bg-surface)]/40' : ''
                }`}
              >
                <div
                  className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-[var(--accent)] text-white'
                      : isCurrentMonth
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  {format(day, 'd')}
                </div>

                {/* Manual blocks */}
                {dayBlocks.slice(0, 1).map((b) => (
                  <div
                    key={b.id}
                    className="text-[10px] text-white rounded px-1 py-0.5 mb-0.5 truncate"
                    style={{ backgroundColor: BLOCK_COLORS[b.blockType] ?? '#9ca3af' }}
                  >
                    {b.reason ?? b.blockType}
                  </div>
                ))}

                {/* Reservations */}
                {dayReservations.slice(0, 2).map((r) => (
                  <button
                    key={r.id}
                    onClick={(e) => { e.stopPropagation(); onReservationClick(r); }}
                    className="w-full text-left text-[10px] text-white rounded px-1 py-0.5 mb-0.5 truncate hover:brightness-90"
                    style={{ backgroundColor: CHANNEL_COLORS[r.channel] ?? '#6b7280' }}
                  >
                    {r.guestName ?? 'Guest'}
                  </button>
                ))}

                {dayReservations.length + dayBlocks.length > 3 && (
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    +{dayReservations.length + dayBlocks.length - 3} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
