'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReservationChannel } from '@/src/domains/reservation/types';
import { CHANNEL_LABELS } from '@/src/domains/reservation/constants';
import Picker from '@/components/ui/Picker';

const CONNECTABLE_CHANNELS: ReservationChannel[] = ['airbnb', 'booking_com', 'vrbo', 'expedia', 'other'];

type Props = {
  propertyId: string;
  existingChannels: string[];
};

export function ConnectChannelButton({ propertyId, existingChannels }: Props) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ReservationChannel>('airbnb');
  const [icalUrl, setIcalUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const available = CONNECTABLE_CHANNELS.filter(c => !existingChannels.includes(c));

  if (available.length === 0) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/properties/${propertyId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, icalUrl: icalUrl || undefined }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to connect channel');
      }
      setOpen(false);
      setIcalUrl('');
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          + Connect Channel
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl p-6 shadow-xl"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-semibold text-lg text-[var(--text-primary)]">
              Connect Channel
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Channel
              </label>
              <Picker
                value={channel}
                onChange={v => setChannel(v as ReservationChannel)}
                options={available.map(c => ({ value: c, label: CHANNEL_LABELS[c] ?? c }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                iCal URL
              </label>
              <input
                type="url"
                value={icalUrl}
                onChange={e => setIcalUrl(e.target.value)}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                {channel === 'airbnb' && 'Airbnb → Calendar → Export calendar → Copy link'}
                {channel === 'booking_com' && 'Booking.com → Reservations → Export → iCal'}
                {channel === 'vrbo' && 'VRBO → Calendar → Sync calendars → iCal link'}
              </p>
            </div>

            {error && (
              <p className="text-sm text-[var(--color-red)]">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg text-sm border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                {loading ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
