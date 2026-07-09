'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, Phone, Mail, Pencil } from 'lucide-react';
import type { HousekeepingStaff } from '@/src/domains/operations/types';

type Property = { id: string; name: string };

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
      status === 'active'
        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
        : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]'
    }`}>
      {status}
    </span>
  );
}

function StaffForm({
  initial,
  properties,
  onClose,
  onSuccess,
}: {
  initial?: HousekeepingStaff;
  properties: Property[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    propertyId: initial?.propertyId ?? '',
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    notes: initial?.notes ?? '',
    status: initial?.status ?? 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.propertyId) { setError('Property is required'); return; }
    setSaving(true);
    setError('');

    const url = initial ? `/api/housekeeping/staff/${initial.id}` : '/api/housekeeping/staff';
    const method = initial ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: form.propertyId,
        name: form.name.trim(),
        phone: form.phone || undefined,
        email: form.email || undefined,
        notes: form.notes || undefined,
        ...(initial ? { status: form.status } : {}),
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSuccess();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to save');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl">
        <div className="border-b border-[var(--border-color)] px-5 py-4">
          <h2 className="font-semibold text-[var(--text-primary)]">{initial ? 'Edit Staff' : 'Add Staff'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Property</label>
            <select
              value={form.propertyId}
              onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
              required
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">Select property…</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              placeholder="Full name"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Phone (WhatsApp)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] resize-none"
            />
          </div>
          {initial && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function StaffManager() {
  const [staff, setStaff] = useState<HousekeepingStaff[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<HousekeepingStaff | null>(null);
  const [propertyFilter, setPropertyFilter] = useState('');

  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p.name]));

  async function fetchData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (propertyFilter) params.set('propertyId', propertyFilter);
    const [staffRes, propsRes] = await Promise.all([
      fetch(`/api/housekeeping/staff?${params}`),
      fetch('/api/properties'),
    ]);
    if (staffRes.ok) { const d = await staffRes.json(); setStaff(d.staff ?? []); }
    if (propsRes.ok) { const d = await propsRes.json(); setProperties(d.properties ?? []); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [propertyFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={propertyFilter}
          onChange={e => setPropertyFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        >
          <option value="">All properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="ml-auto">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add Staff
          </button>
        </div>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No staff yet.</p>
          <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-[var(--accent)] hover:underline">
            Add your first staff member →
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border-color)] overflow-hidden divide-y divide-[var(--border-subtle)]">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-4 py-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--text-primary)]">{s.name}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {propertyMap[s.propertyId] ?? '—'}
                  </span>
                  {s.phone && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                      <Phone size={10} /> {s.phone}
                    </span>
                  )}
                  {s.email && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                      <Mail size={10} /> {s.email}
                    </span>
                  )}
                </div>
                {s.notes && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 italic">{s.notes}</p>}
              </div>
              <button
                onClick={() => setEditing(s)}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <StaffForm
          properties={properties}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); fetchData(); }}
        />
      )}
      {editing && (
        <StaffForm
          initial={editing}
          properties={properties}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); fetchData(); }}
        />
      )}
    </>
  );
}
