import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getUserProfile } from '@/lib/auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { ReservationStatusBadge } from '@/components/reservation/ReservationStatusBadge';
import { ReservationActions } from '@/components/reservation/ReservationActions';
import { ConflictAlertWrapper } from '@/components/reservation/ConflictAlertWrapper';
import { GuestCard } from '@/components/guest/GuestCard';
import { CHANNEL_LABELS } from '@/src/domains/reservation/constants';
import type { Reservation } from '@/src/domains/reservation/types';

type Params = { params: Promise<{ id: string }> };

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
}

type ReservationRow = {
  id: string; organization_id: string; property_id: string; guest_id: string | null;
  channel: string; platform_booking_id: string | null; check_in: string; check_out: string;
  nights: number; adults: number; children: number; pets: number; status: string;
  nightly_rate: string; cleaning_fee: string; taxes: string; other_fees: string;
  gross_revenue: string; platform_commission: string; net_payout: string;
  guest_name: string | null; guest_email: string | null; guest_phone: string | null;
  notes: string | null; raw_payload: Record<string, unknown> | null;
  created_by: string | null; created_at: string; updated_at: string; deleted_at: string | null;
};

async function getReservation(id: string): Promise<Reservation | null> {
  const db = createServiceRoleClientLoose();
  const { data } = await db
    .from('reservations')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) return null;
  const row = data as ReservationRow;

  return {
    id: row.id,
    organizationId: row.organization_id,
    propertyId: row.property_id,
    guestId: row.guest_id ?? undefined,
    channel: row.channel as Reservation['channel'],
    platformBookingId: row.platform_booking_id ?? undefined,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: row.nights,
    adults: row.adults,
    children: row.children,
    pets: row.pets,
    status: row.status as Reservation['status'],
    nightlyRate: Number(row.nightly_rate),
    cleaningFee: Number(row.cleaning_fee),
    taxes: Number(row.taxes),
    otherFees: Number(row.other_fees),
    grossRevenue: Number(row.gross_revenue),
    platformCommission: Number(row.platform_commission),
    netPayout: Number(row.net_payout),
    guestName: row.guest_name ?? undefined,
    guestEmail: row.guest_email ?? undefined,
    guestPhone: row.guest_phone ?? undefined,
    notes: row.notes ?? undefined,
    rawPayload: row.raw_payload ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export default async function ReservationDetailPage({ params }: Params) {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  const { id } = await params;
  const reservation = await getReservation(id);
  if (!reservation) notFound();

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Link
        href="/dashboard/reservations"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        All Reservations
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
          {reservation.guestName ?? 'Reservation'}
        </h1>
        <ReservationStatusBadge status={reservation.status} />
      </div>

      {reservation.status === 'conflict' && (
        <ConflictAlertWrapper reservationId={reservation.id} />
      )}

      <ReservationActions reservationId={reservation.id} status={reservation.status} />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Dates */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-4">Stay</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Check-in</p>
              <p className="font-medium text-[var(--text-primary)]">{fmtDate(reservation.checkIn)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Check-out</p>
              <p className="font-medium text-[var(--text-primary)]">{fmtDate(reservation.checkOut)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Duration</p>
              <p className="font-medium text-[var(--text-primary)]">{reservation.nights} nights</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Guests</p>
              <p className="font-medium text-[var(--text-primary)]">
                {reservation.adults} adult{reservation.adults !== 1 ? 's' : ''}
                {reservation.children > 0 && `, ${reservation.children} children`}
                {reservation.pets > 0 && `, ${reservation.pets} pets`}
              </p>
            </div>
          </div>
        </div>

        {/* Booking info */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-4">Booking</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Channel</p>
              <p className="font-medium text-[var(--text-primary)]">{CHANNEL_LABELS[reservation.channel] ?? reservation.channel}</p>
            </div>
            {reservation.platformBookingId && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Booking reference</p>
                <p className="font-mono text-sm text-[var(--text-primary)]">{reservation.platformBookingId}</p>
              </div>
            )}
          </div>
        </div>

        {/* Guest profile */}
        <GuestCard reservationId={reservation.id} guestId={reservation.guestId} />

        {/* Revenue */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-4">Revenue</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Nightly rate</span>
              <span>{fmt(reservation.nightlyRate)} × {reservation.nights} nights</span>
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
            {reservation.otherFees > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Other fees</span>
                <span>{fmt(reservation.otherFees)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-[var(--border-subtle)] pt-2">
              <span className="text-[var(--text-secondary)]">Gross revenue</span>
              <span>{fmt(reservation.grossRevenue)}</span>
            </div>
            {reservation.platformCommission > 0 && (
              <div className="flex justify-between text-sm text-[var(--color-red)]">
                <span>Platform commission</span>
                <span>−{fmt(reservation.platformCommission)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-[var(--border-color)] pt-2">
              <span>Net payout</span>
              <span className="text-[var(--accent)]">{fmt(reservation.netPayout)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {reservation.notes && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-3">Notes</h2>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{reservation.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
