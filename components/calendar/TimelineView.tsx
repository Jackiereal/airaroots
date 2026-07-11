'use client';

import { useMemo } from 'react';
import { addDays, format, differenceInDays, startOfDay } from 'date-fns';
import type { Reservation } from '@/src/domains/reservation/types';
import type { CalendarBlock } from '@/src/domains/calendar/types';
import { CHANNEL_COLORS } from '@/src/domains/reservation/constants';

type Property = { id: string; name: string };

type Props = {
  properties: Property[];
  reservations: Reservation[];
  blocks: CalendarBlock[];
  from: Date;
  to: Date;
  onReservationClick: (reservation: Reservation) => void;
  onEmptyCellClick: (propertyId: string, date: string) => void;
};

const BLOCK_COLORS: Record<string, string> = {
  owner_hold:     '#6b7280',
  maintenance:    '#f59e0b',
  buffer:         '#d1d5db',
  seasonal_close: '#9ca3af',
};

const ROW_HEIGHT = 48;
const DAY_WIDTH = 36;

export function TimelineView({ properties, reservations, blocks, from, to, onReservationClick, onEmptyCellClick }: Props) {
  const days = useMemo(() => {
    const total = differenceInDays(to, from);
    return Array.from({ length: total }, (_, i) => addDays(from, i));
  }, [from, to]);

  const totalDays = days.length;

  // Group reservations by property
  const resByProperty = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const list = map.get(r.propertyId) ?? [];
      list.push(r);
      map.set(r.propertyId, list);
    }
    return map;
  }, [reservations]);

  // Group manual blocks (non-reservation) by property
  const blocksByProperty = useMemo(() => {
    const map = new Map<string, CalendarBlock[]>();
    for (const b of blocks) {
      if (b.blockType === 'reservation') continue;
      const list = map.get(b.propertyId) ?? [];
      list.push(b);
      map.set(b.propertyId, list);
    }
    return map;
  }, [blocks]);

  function getBlockStyle(startDate: string, endDate: string): React.CSSProperties {
    const blockStart = startOfDay(new Date(startDate + 'T00:00:00'));
    const blockEnd = startOfDay(new Date(endDate + 'T00:00:00'));
    const fromDay = startOfDay(from);

    const rawStartOffset = differenceInDays(blockStart, fromDay);
    const rawEndOffset = differenceInDays(blockEnd, fromDay);

    // Half-day inset at the real start/end only — signals check-in starts mid-day
    // and checkout frees up mid-day. Don't inset an edge that's clipped by the
    // visible window (that boundary isn't the real start/end).
    const startEdge = rawStartOffset >= 0 ? rawStartOffset + 0.5 : 0;
    const endEdge = rawEndOffset <= totalDays ? rawEndOffset - 0.5 : totalDays;

    const startOffset = Math.max(0, startEdge);
    const endOffset = Math.min(totalDays, endEdge);
    const width = endOffset - startOffset;

    if (width <= 0) return { display: 'none' };

    return {
      left: `${startOffset * DAY_WIDTH}px`,
      width: `${width * DAY_WIDTH - 2}px`,
    };
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${180 + totalDays * DAY_WIDTH}px` }}>
        {/* Header row — dates */}
        <div
          className="flex border-b border-[var(--border-color)] bg-[var(--bg-raised)] sticky top-0 z-20"
          style={{ height: 36 }}
        >
          {/* Property label spacer */}
          <div className="flex-shrink-0 border-r border-[var(--border-color)]" style={{ width: 180 }} />
          {/* Day headers */}
          <div className="relative flex-1" style={{ height: 36 }}>
            {days.map((day, i) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isToday = dateStr === today;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={dateStr}
                  className={`absolute top-0 bottom-0 flex flex-col items-center justify-center text-xs border-r border-[var(--border-subtle)] ${
                    isToday ? 'bg-[var(--accent-muted)] font-bold text-[var(--accent)]' : isWeekend ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'
                  }`}
                  style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                >
                  <span>{format(day, 'd')}</span>
                  <span className="text-[10px]">{format(day, 'EEE')}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Property rows */}
        {properties.map((property) => {
          const propReservations = resByProperty.get(property.id) ?? [];
          const propBlocks = blocksByProperty.get(property.id) ?? [];

          return (
            <div
              key={property.id}
              className="flex border-b border-[var(--border-color)] hover:bg-[var(--bg-raised)]/50"
              style={{ height: ROW_HEIGHT }}
            >
              {/* Property name */}
              <div
                className="flex-shrink-0 flex items-center px-3 border-r border-[var(--border-color)] bg-[var(--bg-raised)]"
                style={{ width: 180 }}
              >
                <span className="text-sm font-medium text-[var(--text-primary)] truncate">{property.name}</span>
              </div>

              {/* Timeline cells */}
              <div className="relative flex-1" style={{ height: ROW_HEIGHT }}>
                {/* Day cell backgrounds + click targets */}
                {days.map((day, i) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isToday = dateStr === today;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div
                      key={dateStr}
                      onClick={() => onEmptyCellClick(property.id, dateStr)}
                      className={`absolute top-0 bottom-0 border-r border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--accent-muted)]/40 ${
                        isToday ? 'bg-[var(--accent-muted)]/30' : isWeekend ? 'bg-[var(--bg-surface)]/50' : ''
                      }`}
                      style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                    />
                  );
                })}

                {/* Manual blocks (owner hold, maintenance, etc.) */}
                {propBlocks.map((block) => {
                  const style = getBlockStyle(block.startDate, block.endDate);
                  const color = BLOCK_COLORS[block.blockType] ?? '#9ca3af';
                  return (
                    <div
                      key={block.id}
                      className="absolute inset-y-1 rounded opacity-70 flex items-center px-2 overflow-hidden"
                      style={{ ...style, backgroundColor: color }}
                      title={block.reason || block.blockType}
                    >
                      <span className="text-white text-xs truncate">{block.reason || block.blockType}</span>
                    </div>
                  );
                })}

                {/* Reservations */}
                {propReservations.map((res) => {
                  const style = getBlockStyle(res.checkIn, res.checkOut);
                  const color = CHANNEL_COLORS[res.channel] ?? '#6b7280';
                  return (
                    <button
                      key={res.id}
                      onClick={(e) => { e.stopPropagation(); onReservationClick(res); }}
                      className="absolute inset-y-1 rounded flex items-center px-2 overflow-hidden text-white text-xs font-medium hover:brightness-90 transition-all z-10 cursor-pointer"
                      style={{ ...style, backgroundColor: color }}
                      title={`${res.guestName ?? 'Guest'} · ${res.checkIn} – ${res.checkOut}`}
                    >
                      <span className="truncate">{res.guestName ?? 'Guest'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 px-2 flex-wrap">
        <span className="text-xs text-[var(--text-tertiary)] font-medium">Channels:</span>
        {[
          { label: 'Airbnb', color: CHANNEL_COLORS['airbnb']! },
          { label: 'Booking.com', color: CHANNEL_COLORS['booking_com']! },
          { label: 'Direct', color: CHANNEL_COLORS['direct']! },
          { label: 'VRBO', color: CHANNEL_COLORS['vrbo']! },
          { label: 'Owner Hold', color: BLOCK_COLORS['owner_hold']! },
          { label: 'Maintenance', color: BLOCK_COLORS['maintenance']! },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-[var(--text-secondary)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
