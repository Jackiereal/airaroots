'use client';

import { useState } from 'react';
import { X, Calendar, User, DollarSign, Hash, Phone, Mail, FileText } from 'lucide-react';
import type { Reservation } from '@/src/domains/reservation/types';
import { ReservationStatusBadge } from './ReservationStatusBadge';
import { CHANNEL_LABELS } from '@/src/domains/reservation/constants';

type Props = {
  reservation: Reservation | null;
  onClose: () => void;
  onStatusChange?: (reservationId: string, action: 'check-in' | 'check-out' | 'cancel') => Promise<void>;
};

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ReservationDetail({ reservation, onClose, onStatusChange }: Props) {
  const [loading, setLoading] = useState(false);

  if (!reservation) return null;

  const handleAction = async (action: 'check-in' | 'check-out' | 'cancel') => {
    if (!onStatusChange) return;
    setLoading(true);
    try {
      await onStatusChange(reservation.id, action);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--bg-base)] shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Reservation</h2>
            <ReservationStatusBadge status={reservation.status} size="sm" />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Guest */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <User size={13} />
              Guest
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-[var(--text-primary)]">{reservation.guestName ?? '—'}</p>
              {reservation.guestEmail && (
                <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Mail size={13} />
                  {reservation.guestEmail}
                </p>
              )}
              {reservation.guestPhone && (
                <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Phone size={13} />
                  {reservation.guestPhone}
                </p>
              )}
              <p className="text-sm text-[var(--text-secondary)]">
                {reservation.adults} adult{reservation.adults !== 1 ? 's' : ''}
                {reservation.children > 0 && `, ${reservation.children} child${reservation.children !== 1 ? 'ren' : ''}`}
                {reservation.pets > 0 && `, ${reservation.pets} pet${reservation.pets !== 1 ? 's' : ''}`}
              </p>
            </div>
          </section>

          {/* Dates */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <Calendar size={13} />
              Dates
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--bg-surface)] rounded-lg p-3">
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Check-in</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{fmtDate(reservation.checkIn)}</p>
              </div>
              <div className="bg-[var(--bg-surface)] rounded-lg p-3">
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Check-out</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{fmtDate(reservation.checkOut)}</p>
              </div>
              <div className="bg-[var(--bg-surface)] rounded-lg p-3">
                <p className="text-xs text-[var(--text-tertiary)] mb-1">Nights</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{reservation.nights}</p>
              </div>
            </div>
          </section>

          {/* Channel */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <Hash size={13} />
              Channel
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {CHANNEL_LABELS[reservation.channel] ?? reservation.channel}
              </span>
              {reservation.platformBookingId && (
                <span className="text-xs text-[var(--text-tertiary)] font-mono">
                  {reservation.platformBookingId}
                </span>
              )}
            </div>
          </section>

          {/* Financials */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <DollarSign size={13} />
              Revenue
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Nightly rate</span>
                <span>{fmt(reservation.nightlyRate)} × {reservation.nights}</span>
              </div>
              {reservation.cleaningFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Cleaning fee</span>
                  <span>{fmt(reservation.cleaningFee)}</span>
                </div>
              )}
              {reservation.taxes > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Taxes</span>
                  <span>{fmt(reservation.taxes)}</span>
                </div>
              )}
              {reservation.platformCommission > 0 && (
                <div className="flex justify-between text-sm text-[var(--color-red)]">
                  <span>Platform commission</span>
                  <span>−{fmt(reservation.platformCommission)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-[var(--border-color)] pt-2 mt-2">
                <span>Net payout</span>
                <span className="text-[var(--accent)]">{fmt(reservation.netPayout)}</span>
              </div>
            </div>
          </section>

          {/* Notes */}
          {reservation.notes && (
            <section>
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                <FileText size={13} />
                Notes
              </div>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{reservation.notes}</p>
            </section>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex gap-2">
          {reservation.status === 'confirmed' && (
            <button
              onClick={() => handleAction('check-in')}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              Check In
            </button>
          )}
          {reservation.status === 'checked_in' && (
            <button
              onClick={() => handleAction('check-out')}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              Check Out
            </button>
          )}
          {(reservation.status === 'confirmed' || reservation.status === 'checked_in') && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={loading}
              className="flex-1 py-2 rounded-lg border border-[var(--color-red)] text-[var(--color-red)] text-sm font-medium hover:bg-[var(--color-red-muted)] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </>
  );
}
