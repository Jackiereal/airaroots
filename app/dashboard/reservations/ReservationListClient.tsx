'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import type { Reservation } from '@/src/domains/reservation/types';
import { ReservationStatusBadge } from '@/components/reservation/ReservationStatusBadge';
import { ReservationForm } from '@/components/reservation/ReservationForm';
import { CHANNEL_LABELS } from '@/src/domains/reservation/constants';
import { ResponsiveTable, TableCard } from '@/components/ui/ResponsiveTable';

type Property = { id: string; name: string };

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function ReservationListClient() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const [resRes, propRes] = await Promise.all([
      fetch('/api/reservations?limit=100'),
      fetch('/api/properties'),
    ]);
    if (resRes.ok) {
      const d = await resRes.json();
      setReservations(d.reservations ?? []);
    }
    if (propRes.ok) {
      const d = await propRes.json();
      setProperties(d.properties ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  const conflictCount = reservations.filter(r => r.status === 'conflict').length;
  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p.name]));

  return (
    <>
      {conflictCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-amber)] bg-[var(--color-amber-muted)] px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-[var(--color-amber)] shrink-0" />
          <p className="text-sm text-[var(--text-primary)]">
            <span className="font-semibold">{conflictCount} booking conflict{conflictCount > 1 ? 's' : ''}</span>
            {' '}need{conflictCount === 1 ? 's' : ''} attention.
          </p>
          <a
            href="?status=conflict"
            className="ml-auto text-xs font-medium text-[var(--color-amber)] hover:underline underline-offset-2 shrink-0"
          >
            View conflicts →
          </a>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          <Plus size={16} />
          New Reservation
        </button>
      </div>

      {reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No reservations yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-[var(--accent)] hover:underline underline-offset-2"
          >
            Create first reservation →
          </button>
        </div>
      ) : (
        <ResponsiveTable
          table={
            <div className="rounded-xl border border-[var(--border-color)] overflow-x-auto overscroll-x-contain touch-pan-x">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Guest</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Property</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Dates</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Channel</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Net Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]/60 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/reservations/${r.id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                        >
                          {r.guestName ?? '—'}
                        </Link>
                        <p className="text-xs text-[var(--text-tertiary)]">{r.nights} nights</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {propertyMap[r.propertyId] ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        <span>{fmtDate(r.checkIn)}</span>
                        <span className="mx-1 text-[var(--text-tertiary)]">→</span>
                        <span>{fmtDate(r.checkOut)}</span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {CHANNEL_LABELS[r.channel] ?? r.channel}
                      </td>
                      <td className="px-4 py-3">
                        <ReservationStatusBadge status={r.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--text-primary)]">
                        {fmt(r.netPayout)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
          cards={
            <div className="space-y-3">
              {reservations.map((r) => (
                <TableCard
                  key={r.id}
                  title={
                    <Link
                      href={`/dashboard/reservations/${r.id}`}
                      className="font-medium text-sm text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                    >
                      {r.guestName ?? '—'}
                      <span className="block text-xs text-[var(--text-tertiary)] font-normal">{r.nights} nights</span>
                    </Link>
                  }
                  titleExtra={<ReservationStatusBadge status={r.status} size="sm" />}
                  fields={[
                    { label: 'Property', value: propertyMap[r.propertyId] ?? '—' },
                    { label: 'Channel', value: CHANNEL_LABELS[r.channel] ?? r.channel },
                    { label: 'Dates', value: `${fmtDate(r.checkIn)} → ${fmtDate(r.checkOut)}` },
                    { label: 'Net Payout', value: <span className="font-medium text-[var(--text-primary)]">{fmt(r.netPayout)}</span> },
                  ]}
                />
              ))}
            </div>
          }
        />
      )}

      <ReservationForm
        open={showForm}
        onClose={() => setShowForm(false)}
        properties={properties}
        onSuccess={() => { setShowForm(false); fetchAll(); }}
      />
    </>
  );
}
