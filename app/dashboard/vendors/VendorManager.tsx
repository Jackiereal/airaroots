'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, Phone, Mail, MapPin, Pencil, Ban, RotateCcw } from 'lucide-react';
import type { Vendor, VendorCategory } from '@/src/domains/operations/types';

const CATEGORY_LABELS: Record<VendorCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  cleaning: 'Cleaning',
  carpentry: 'Carpentry',
  hvac: 'HVAC',
  pest_control: 'Pest Control',
  landscaping: 'Landscaping',
  security: 'Security',
  other: 'Other',
};

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
      isActive
        ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
        : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]'
    }`}>
      {isActive ? 'active' : 'inactive'}
    </span>
  );
}

function VendorForm({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: Vendor;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    category: initial?.category ?? ('' as VendorCategory | ''),
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    ratePerVisit: initial?.ratePerVisit != null ? String(initial.ratePerVisit) : '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');

    const url = initial ? `/api/vendors/${initial.id}` : '/api/vendors';
    const method = initial ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        category: form.category || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        ratePerVisit: form.ratePerVisit ? Number(form.ratePerVisit) : undefined,
        notes: form.notes || undefined,
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
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="border-b border-[var(--border-color)] px-5 py-4">
          <h2 className="font-semibold text-[var(--text-primary)]">{initial ? 'Edit Vendor' : 'Add Vendor'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              placeholder="e.g. Sri Balaji Plumbing Works"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as VendorCategory | '' }))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">Select…</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Address (optional)</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Rate per Visit ₹ (optional)</label>
            <input
              type="number"
              value={form.ratePerVisit}
              onChange={e => setForm(f => ({ ...f, ratePerVisit: e.target.value }))}
              min="0"
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
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function VendorManager() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function fetchVendors() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('activeOnly', showInactive ? 'false' : 'true');
    if (categoryFilter) params.set('category', categoryFilter);
    const res = await fetch(`/api/vendors?${params}`);
    if (res.ok) {
      const d = await res.json();
      setVendors(d.vendors ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { fetchVendors(); }, [categoryFilter, showInactive]);

  async function handleToggleActive(v: Vendor) {
    setToggling(v.id);
    await fetch(`/api/vendors/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    setToggling(null);
    fetchVendors();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <div className="ml-auto">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add Vendor
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : vendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No vendors yet.</p>
          <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-[var(--accent)] hover:underline">
            Add your first vendor →
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border-color)] overflow-hidden divide-y divide-[var(--border-subtle)]">
          {vendors.map(v => (
            <div key={v.id} className="flex items-center gap-4 px-4 py-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--text-primary)]">{v.name}</span>
                  {v.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-tertiary)] font-medium">
                      {CATEGORY_LABELS[v.category]}
                    </span>
                  )}
                  <StatusBadge isActive={v.isActive} />
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {v.phone && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                      <Phone size={10} /> {v.phone}
                    </span>
                  )}
                  {v.email && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                      <Mail size={10} /> {v.email}
                    </span>
                  )}
                  {v.address && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                      <MapPin size={10} /> {v.address}
                    </span>
                  )}
                  {v.ratePerVisit != null && (
                    <span className="text-xs text-[var(--text-tertiary)]">
                      ₹{v.ratePerVisit.toLocaleString('en-IN')}/visit
                    </span>
                  )}
                </div>
                {v.notes && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 italic">{v.notes}</p>}
              </div>
              <button
                onClick={() => handleToggleActive(v)}
                disabled={toggling === v.id}
                title={v.isActive ? 'Deactivate' : 'Reactivate'}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-50"
              >
                {v.isActive ? <Ban size={14} /> : <RotateCcw size={14} />}
              </button>
              <button
                onClick={() => setEditing(v)}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <VendorForm
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); fetchVendors(); }}
        />
      )}
      {editing && (
        <VendorForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); fetchVendors(); }}
        />
      )}
    </>
  );
}
