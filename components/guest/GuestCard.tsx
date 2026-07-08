'use client';

import { useEffect, useState } from 'react';
import { User, Phone, Mail, Tag, FileText, Plus, Loader2 } from 'lucide-react';
import type { GuestWithStays } from '@/src/domains/guest/types';

type Props = {
  reservationId: string;
  guestId: string | undefined;
};

const TAG_COLORS: Record<string, string> = {
  vip:          'bg-[var(--tone-violet-bg)] text-[var(--tone-violet-tx)] border-[var(--tone-violet-bd)]',
  repeat:       'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]',
  problematic:  'bg-[var(--color-red-muted)] text-[var(--color-red)] border-[var(--color-red)]',
  long_stay:    'bg-[var(--color-blue-muted)] text-[var(--color-blue)] border-[var(--color-blue)]',
  early_bird:   'bg-[var(--color-amber-muted)] text-[var(--color-amber)] border-[var(--color-amber)]',
};

export function GuestCard({ reservationId, guestId }: Props) {
  const [guest, setGuest] = useState<GuestWithStays | null>(null);
  const [loading, setLoading] = useState(!!guestId);
  const [linking, setLinking] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (!guestId) return;
    fetch(`/api/guests/${guestId}`)
      .then(r => r.json())
      .then(d => {
        setGuest(d.guest ?? null);
        setNotes(d.guest?.notes ?? '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [guestId]);

  async function linkGuest() {
    setLinking(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/guest`, { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        setGuest(d.guest);
        setNotes(d.guest?.notes ?? '');
      }
    } finally {
      setLinking(false);
    }
  }

  async function saveNotes() {
    if (!guest) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const d = await res.json();
        setGuest(prev => prev ? { ...prev, notes: d.guest.notes } : null);
        setEditingNotes(false);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function toggleTag(tag: string) {
    if (!guest) return;
    const newTags = guest.tags.includes(tag)
      ? guest.tags.filter(t => t !== tag)
      : [...guest.tags, tag];

    const res = await fetch(`/api/guests/${guest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    });
    if (res.ok) {
      setGuest(prev => prev ? { ...prev, tags: newTags } : null);
    }
  }

  const effectiveStayCount = guest ? Math.max(guest.stayCount, 1) : 0;
  const isRepeat = effectiveStayCount > 1;

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <User size={13} className="text-[var(--text-tertiary)]" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Guest Profile</h2>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </div>
      )}

      {!loading && !guest && (
        <div className="text-center py-2">
          <p className="text-sm text-[var(--text-tertiary)] mb-3">No guest profile linked.</p>
          <button
            onClick={linkGuest}
            disabled={linking}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {linking ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {linking ? 'Linking…' : 'Create Guest Profile'}
          </button>
        </div>
      )}

      {!loading && guest && (
        <div className="space-y-4">
          {/* Identity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-[var(--text-primary)]">{guest.fullName}</p>
              <span className="text-xs text-[var(--text-tertiary)]">
                {effectiveStayCount} stay{effectiveStayCount !== 1 ? 's' : ''}
                {isRepeat && <span className="ml-1 text-[var(--accent)]">· repeat</span>}
              </span>
            </div>
            {guest.email && (
              <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Mail size={12} className="text-[var(--text-tertiary)] shrink-0" />
                {guest.email}
              </p>
            )}
            {guest.phone && (
              <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Phone size={12} className="text-[var(--text-tertiary)] shrink-0" />
                {guest.phone}
              </p>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Tag size={11} className="text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)]">Tags</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['vip', 'repeat', 'long_stay', 'early_bird', 'problematic'] as const).map(tag => {
                const active = guest.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      active
                        ? (TAG_COLORS[tag] ?? 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)]')
                        : 'bg-transparent text-[var(--text-tertiary)] border-[var(--border-subtle)] hover:border-[var(--border-color)]'
                    }`}
                  >
                    {tag.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <FileText size={11} className="text-[var(--text-tertiary)]" />
                <span className="text-xs text-[var(--text-tertiary)]">Internal notes</span>
              </div>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-xs text-[var(--accent)] hover:underline underline-offset-2"
                >
                  {guest.notes ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                  placeholder="Notes visible only to your team…"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="text-xs px-3 py-1 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    {savingNotes ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingNotes(false); setNotes(guest.notes ?? ''); }}
                    className="text-xs px-3 py-1 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                {guest.notes ?? <span className="text-[var(--text-tertiary)] italic">No notes</span>}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
