'use client';

import { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, differenceInDays, startOfDay } from 'date-fns';
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

// Deterministic avatar hue per name — same guest always gets the same color.
const AVATAR_HUES = [4, 24, 44, 160, 200, 260, 320];
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
  return `hsl(${hue} 70% 45%)`;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BAR_HEIGHT = 28;
const BAR_GAP = 4;
const BAR_TOP_OFFSET = 30; // below the date number

type Bar = {
  key: string;
  label: string;
  guestCount?: number;
  avatarSeed?: string;
  color: string;
  isBlock: boolean;
  startCol: number; // 0-6, inclusive
  endCol: number;   // 0-6, inclusive (last occupied column in this week)
  isStart: boolean; // true if the bar's real start date falls in this week
  isEnd: boolean;   // true if the bar's real end date falls in this week
  onClick?: () => void;
};

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

  // Bars per week row: each reservation/block clipped to [weekStart, weekEnd],
  // split into one segment per week it spans (Airbnb-style continuous bar).
  const barsByWeek = useMemo(() => {
    type Span = {
      start: Date;
      end: Date;
      label: string;
      guestCount?: number;
      avatarSeed?: string;
      color: string;
      isBlock: boolean;
      onClick?: () => void;
    };

    const spans: Span[] = [
      ...blocks
        .filter((b) => b.blockType !== 'reservation')
        .map((b) => ({
          start: startOfDay(new Date(b.startDate + 'T00:00:00')),
          end: startOfDay(new Date(b.endDate + 'T00:00:00')),
          label: b.reason || b.blockType,
          color: BLOCK_COLORS[b.blockType] ?? '#9ca3af',
          isBlock: true,
        })),
      ...reservations.map((r) => {
        const guestCount = (r.adults ?? 1) + (r.children ?? 0);
        const name = r.guestName?.trim() || 'Guest';
        return {
          start: startOfDay(new Date(r.checkIn + 'T00:00:00')),
          end: startOfDay(new Date(r.checkOut + 'T00:00:00')),
          label: guestCount > 1 ? `${name} +${guestCount - 1}` : name,
          guestCount,
          avatarSeed: name,
          color: CHANNEL_COLORS[r.channel] ?? '#6b7280',
          isBlock: false,
          onClick: () => onReservationClick(r),
        };
      }),
    ];

    return weeks.map((week) => {
      const weekStart = startOfDay(week[0]!);
      const weekEnd = startOfDay(addDays(week[6]!, 1)); // exclusive end of week

      const bars: Bar[] = [];
      for (const span of spans) {
        // Skip if this span doesn't overlap this week at all.
        if (span.end <= weekStart || span.start >= weekEnd) continue;

        const clippedStart = span.start < weekStart ? weekStart : span.start;
        const clippedEndExclusive = span.end > weekEnd ? weekEnd : span.end;

        const startCol = differenceInDays(clippedStart, weekStart);
        const endCol = differenceInDays(clippedEndExclusive, weekStart) - 1;
        if (endCol < startCol) continue;

        bars.push({
          key: `${span.label}-${span.start.toISOString()}-${startCol}`,
          label: span.label,
          guestCount: span.guestCount,
          avatarSeed: span.avatarSeed,
          color: span.color,
          isBlock: span.isBlock,
          startCol,
          endCol,
          isStart: span.start >= weekStart,
          isEnd: span.end <= weekEnd,
          onClick: span.onClick,
        });
      }

      // Stack bars into rows (greedy): each bar gets the first row where it doesn't collide.
      const rows: Bar[][] = [];
      for (const bar of bars.sort((a, b) => a.startCol - b.startCol)) {
        let placed = false;
        for (const row of rows) {
          if (row.every((b) => bar.startCol > b.endCol || bar.endCol < b.startCol)) {
            row.push(bar);
            placed = true;
            break;
          }
        }
        if (!placed) rows.push([bar]);
      }

      return rows;
    });
  }, [weeks, reservations, blocks, onReservationClick]);

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
      {weeks.map((week, wi) => {
        const rows = barsByWeek[wi]!;
        const maxVisibleRows = 3;
        const visibleRows = rows.slice(0, maxVisibleRows);
        const overflowCount = rows.length - maxVisibleRows;
        const rowsHeight = visibleRows.length * (BAR_HEIGHT + BAR_GAP);
        const minHeight = Math.max(90, BAR_TOP_OFFSET + rowsHeight + (overflowCount > 0 ? 16 : 4));

        return (
          <div key={wi} className="relative grid grid-cols-7 border-b border-[var(--border-color)]" style={{ minHeight }}>
            {week.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isCurrentMonth = isSameMonth(day, month);
              const isToday = dateStr === today;

              return (
                <div
                  key={dateStr}
                  onClick={() => onDateClick(dateStr)}
                  className={`p-1.5 border-r border-[var(--border-color)] cursor-pointer transition-colors hover:bg-[var(--accent-muted)]/30 ${
                    !isCurrentMonth ? 'bg-[var(--bg-surface)]/40' : ''
                  }`}
                >
                  <div
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-[var(--accent)] text-white'
                        : isCurrentMonth
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              );
            })}

            {/* Spanning bars, absolutely positioned across the 7-column grid */}
            <div className="absolute inset-x-0 pointer-events-none" style={{ top: BAR_TOP_OFFSET }}>
              {visibleRows.map((row, ri) => (
                <div key={ri} style={{ position: 'relative', height: BAR_HEIGHT, marginBottom: BAR_GAP }}>
                  {row.map((bar) => {
                    // Start half a column into check-in day; end half a column into
                    // checkout day — visually signals "checkout day is still free after noon".
                    const startEdge = bar.startCol + (bar.isStart ? 0.5 : 0);
                    const endEdge = bar.endCol + 1 - (bar.isEnd ? 0.5 : 0);
                    const leftPct = (startEdge / 7) * 100;
                    const widthPct = ((endEdge - startEdge) / 7) * 100;

                    const initial = (bar.avatarSeed ?? bar.label).trim().charAt(0).toUpperCase() || '?';

                    return (
                      <button
                        key={bar.key}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); bar.onClick?.(); }}
                        disabled={!bar.onClick}
                        className={`absolute top-0 flex items-center gap-1.5 pointer-events-auto ${bar.onClick ? 'hover:brightness-110 cursor-pointer' : 'cursor-default'} ${
                          bar.isStart ? 'pl-0.5 rounded-l-full' : 'pl-2'
                        } ${bar.isEnd ? 'pr-3 rounded-r-full' : 'pr-2'}`}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          height: BAR_HEIGHT,
                          backgroundColor: bar.color,
                        }}
                        title={`${bar.label}${bar.isBlock ? '' : ` · ${bar.guestCount} guest${bar.guestCount === 1 ? '' : 's'}`}`}
                      >
                        {bar.isStart && !bar.isBlock && (
                          <span
                            className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-white/20"
                            style={{ backgroundColor: avatarColor(bar.avatarSeed ?? bar.label) }}
                          >
                            {initial}
                          </span>
                        )}
                        <span className="truncate text-[11px] font-medium text-white">
                          {bar.isBlock && bar.isStart ? bar.label : bar.isBlock ? '' : bar.isStart ? bar.label : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {overflowCount > 0 && (
                <div className="text-[10px] text-[var(--text-tertiary)] px-1.5">+{overflowCount} more</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
