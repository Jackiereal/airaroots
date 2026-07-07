'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { RefreshCw, Pause, Play, Pencil, Trash2, X, Loader2 } from 'lucide-react';

type Props = {
  propertyId: string;
  connectionId: string;
  status: string;
  icalUrl: string | null;
};

export function ChannelConnectionActions({ propertyId, connectionId, status, icalUrl }: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; error?: string } | null>(null);
  const [toggling, setToggling] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUrl, setEditUrl] = useState(icalUrl ?? '');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const connectionUrl = `/api/properties/${propertyId}/channels/${connectionId}`;

  async function handleSyncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(connectionUrl, { method: 'POST' });
      const data = await res.json() as {
        reservationsCreated?: number;
        reservationsUpdated?: number;
        errorMessage?: string;
        status?: string;
      };
      setSyncResult({
        created: data.reservationsCreated ?? 0,
        updated: data.reservationsUpdated ?? 0,
        error: data.status === 'failed' ? (data.errorMessage ?? 'Sync failed') : undefined,
      });
      router.refresh();
    } catch {
      setSyncResult({ created: 0, updated: 0, error: 'Network error' });
    } finally {
      setSyncing(false);
    }
  }

  async function handleTogglePause() {
    setToggling(true);
    try {
      await fetch(connectionUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status === 'paused' ? 'active' : 'paused' }),
      });
      router.refresh();
    } finally {
      setToggling(false);
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    try {
      const res = await fetch(connectionUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icalUrl: editUrl || undefined }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Update failed');
      }
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await fetch(connectionUrl, { method: 'DELETE' });
      router.refresh();
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Sync Now */}
      <button
        type="button"
        onClick={handleSyncNow}
        disabled={syncing || status === 'paused'}
        title="Sync now"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)] hover:border-[var(--accent)]/40 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {syncing ? 'Syncing…' : 'Sync now'}
      </button>

      {/* Pause / Resume */}
      <button
        type="button"
        onClick={handleTogglePause}
        disabled={toggling}
        title={status === 'paused' ? 'Resume syncing' : 'Pause syncing'}
        className="inline-flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40"
      >
        {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
      </button>

      {/* Edit iCal URL */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            title="Edit iCal URL"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-1.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">Edit iCal URL</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>
              </Dialog.Close>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">iCal URL</label>
                <input
                  type="url"
                  required
                  value={editUrl}
                  onChange={e => setEditUrl(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                />
              </div>
              {editError && <p className="text-sm text-[var(--color-red)]">{editError}</p>}
              <div className="flex gap-3">
                <Dialog.Close asChild>
                  <button type="button" className="flex-1 rounded-lg border border-[var(--border-color)] py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-60"
                >
                  {editLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete */}
      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            title="Disconnect channel"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-1.5 text-[var(--text-secondary)] transition-colors hover:text-rose-400 hover:border-rose-400/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl">
            <Dialog.Title className="text-base font-semibold text-[var(--text-primary)] mb-2">Disconnect channel?</Dialog.Title>
            <p className="text-sm text-[var(--text-secondary)] mb-5">This stops auto-sync. Existing reservations are not deleted.</p>
            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button type="button" className="flex-1 rounded-lg border border-[var(--border-color)] py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-500 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
              >
                {deleteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Disconnect
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Sync result toast */}
      {syncResult && (
        <div className={`absolute right-0 mt-1 text-xs rounded-lg px-3 py-1.5 ${syncResult.error ? 'bg-[var(--tone-rose-bg)] text-[var(--tone-rose-tx)]' : 'bg-[var(--tone-income-bg)] text-[var(--tone-income-tx)]'}`}>
          {syncResult.error ? syncResult.error : `+${syncResult.created} new, ${syncResult.updated} updated`}
        </div>
      )}
    </div>
  );
}
