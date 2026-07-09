'use client';

import { useCallback, useEffect, useState } from 'react';
import { addMonths, subMonths, format, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar, LayoutList } from 'lucide-react';
import type { Reservation } from '@/src/domains/reservation/types';
import type { CalendarBlock } from '@/src/domains/calendar/types';
import { TimelineView } from './TimelineView';
import { MonthView } from './MonthView';
import { ReservationDetail } from '../reservation/ReservationDetail';
import { ReservationForm } from '../reservation/ReservationForm';
import { BlockDateModal } from './BlockDateModal';
import Picker from '@/components/ui/Picker';

type Property = { id: string; name: string };

type ViewMode = 'timeline' | 'month';

type Props = {
  properties: Property[];
  defaultPropertyId?: string;
};

export function ReservationCalendar({ properties, defaultPropertyId }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProperty, setSelectedProperty] = useState(defaultPropertyId ?? properties[0]?.id ?? '');

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [clickedDate, setClickedDate] = useState<string | undefined>();
  const [clickedPropertyId, setClickedPropertyId] = useState<string | undefined>();

  const from = startOfMonth(currentDate);
  const to = endOfMonth(currentDate);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fromStr = format(from, 'yyyy-MM-dd');
      const toStr = format(addDays(to, 1), 'yyyy-MM-dd');

      const [resRes, blockRes] = await Promise.all([
        fetch(`/api/reservations?limit=200`),
        fetch(`/api/calendar?from=${fromStr}&to=${toStr}`),
      ]);

      if (resRes.ok) {
        const data = await resRes.json();
        setReservations((data.reservations as Reservation[]) ?? []);
      }
      if (blockRes.ok) {
        const data = await blockRes.json();
        setBlocks((data.blocks as CalendarBlock[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [from.toISOString(), to.toISOString()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Supabase Realtime — subscribe to reservation changes and refresh
  useEffect(() => {
    // Dynamic import to avoid SSR issues
    let channel: { unsubscribe: () => void } | null = null;

    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      channel = supabase
        .channel('reservations-calendar')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
          fetchData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_blocks' }, () => {
          fetchData();
        })
        .subscribe();
    });

    return () => {
      channel?.unsubscribe();
    };
  }, [fetchData]);

  const handleStatusChange = async (id: string, action: 'check-in' | 'check-out' | 'cancel') => {
    const path = action === 'cancel' ? 'cancel' : action;
    const body = action === 'cancel' ? { reason: 'Cancelled via dashboard' } : {};
    const res = await fetch(`/api/reservations/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setSelectedReservation(null);
      fetchData();
    }
  };

  const handleEmptyCellClick = (propertyId: string, date: string) => {
    setClickedPropertyId(propertyId);
    setClickedDate(date);
    // Show a quick choice: reservation or block
    setShowReservationForm(true);
  };

  const filteredReservations = viewMode === 'month' && selectedProperty
    ? reservations.filter((r) => r.propertyId === selectedProperty)
    : reservations;

  const filteredBlocks = viewMode === 'month' && selectedProperty
    ? blocks.filter((b) => b.propertyId === selectedProperty)
    : blocks;

  return (
    <div className="bg-[var(--bg-base)]">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate((d) => subMonths(d, 1))}
            className="p-2 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-[var(--text-primary)] min-w-[120px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentDate((d) => addMonths(d, 1))}
            className="p-2 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <LayoutList size={14} />
              Timeline
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <Calendar size={14} />
              Month
            </button>
          </div>

          {/* Property selector (month view only) */}
          {viewMode === 'month' && properties.length > 1 && (
            <Picker
              value={selectedProperty}
              onChange={setSelectedProperty}
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
              className="shrink-0"
              searchable
            />
          )}

          {/* New reservation */}
          <button
            onClick={() => { setClickedDate(undefined); setShowReservationForm(true); }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors shrink-0"
          >
            <Plus size={14} />
            <span className="whitespace-nowrap">New Reservation</span>
          </button>

          {/* Block dates */}
          <button
            onClick={() => { setClickedDate(undefined); setShowBlockModal(true); }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors shrink-0"
          >
            Block Dates
          </button>
        </div>
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="h-0.5 bg-[var(--accent)] rounded-full mb-2 animate-pulse" />
      )}

      {/* Calendar view */}
      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
        {viewMode === 'timeline' ? (
          <TimelineView
            properties={properties}
            reservations={reservations}
            blocks={blocks}
            from={from}
            to={addDays(to, 1)}
            onReservationClick={setSelectedReservation}
            onEmptyCellClick={handleEmptyCellClick}
          />
        ) : (
          <MonthView
            month={currentDate}
            reservations={filteredReservations}
            blocks={filteredBlocks}
            onReservationClick={setSelectedReservation}
            onDateClick={(date) => { setClickedDate(date); setShowReservationForm(true); }}
          />
        )}
      </div>

      {/* Modals / panels */}
      <ReservationDetail
        reservation={selectedReservation}
        onClose={() => setSelectedReservation(null)}
        onStatusChange={handleStatusChange}
      />

      <ReservationForm
        open={showReservationForm}
        onClose={() => setShowReservationForm(false)}
        properties={properties}
        defaultPropertyId={clickedPropertyId ?? selectedProperty}
        defaultCheckIn={clickedDate}
        onSuccess={() => { setShowReservationForm(false); fetchData(); }}
      />

      <BlockDateModal
        open={showBlockModal}
        propertyId={clickedPropertyId ?? selectedProperty}
        defaultDate={clickedDate}
        onClose={() => setShowBlockModal(false)}
        onSuccess={() => { setShowBlockModal(false); fetchData(); }}
      />
    </div>
  );
}
