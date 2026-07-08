'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, Phone, RefreshCw, Copy, Trash2 } from 'lucide-react';
import type {
  MaintenanceRequest,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  Vendor,
} from '@/src/domains/operations/types';

type Property = { id: string; name: string };

const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  low: 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  urgent: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
};

const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  reported: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  assigned: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-violet-500/10 text-violet-400',
  resolved: 'bg-[var(--accent)]/10 text-[var(--accent)]',
  closed: 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]',
};

const CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  appliance: 'Appliance',
  structural: 'Structural',
  hvac: 'HVAC',
  pest: 'Pest Control',
  furniture: 'Furniture',
  other: 'Other',
};

function PriorityBadge({ priority }: { priority: MaintenancePriority }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${PRIORITY_COLORS[priority]}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: MaintenanceStatus }) {
  const labels: Record<MaintenanceStatus, string> = {
    reported: 'Reported',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[status]}`}>
      {labels[status]}
    </span>
  );
}

function CreateModal({
  open,
  properties,
  vendors,
  onClose,
  onSuccess,
}: {
  open: boolean;
  properties: Property[];
  vendors: Vendor[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    propertyId: '',
    title: '',
    description: '',
    category: '' as MaintenanceCategory | '',
    priority: 'medium' as MaintenancePriority,
    vendorId: '',
    estimatedCost: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.propertyId || !form.title.trim()) { setError('Property and title are required'); return; }
    setSaving(true);
    setError('');
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: form.propertyId,
        title: form.title.trim(),
        description: form.description || undefined,
        category: form.category || undefined,
        priority: form.priority,
        vendorId: form.vendorId || undefined,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSuccess();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to create');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="border-b border-[var(--border-color)] px-5 py-4">
          <h2 className="font-semibold text-[var(--text-primary)]">New Maintenance Request</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Property</label>
            <select
              value={form.propertyId}
              onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">Select property…</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
              placeholder="e.g. AC not cooling in bedroom"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as MaintenanceCategory | '' }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="">Select…</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as MaintenancePriority }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Assign Vendor (optional)</label>
            <select
              value={form.vendorId}
              onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">No vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.category ? ` (${v.category})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Estimated Cost ₹ (optional)</label>
            <input
              type="number"
              value={form.estimatedCost}
              onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))}
              min="0"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Creating…' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function buildVendorWhatsAppUrl(request: MaintenanceRequest, vendor: Vendor, baseUrl: string) {
  const tokenUrl = `${baseUrl}/maintenance/${request.accessToken}`;
  const msg = `Hi ${vendor.name}, you have a maintenance job assigned:\n\n${request.title}${request.description ? `\n${request.description}` : ''}\n\nView details & mark resolved: ${tokenUrl}`;
  return `https://wa.me/${vendor.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

export function MaintenanceList() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p.name]));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);

    const [reqRes, propsRes, vendorRes] = await Promise.all([
      fetch(`/api/maintenance?${params}`),
      fetch('/api/properties'),
      fetch('/api/vendors?activeOnly=true'),
    ]);

    if (reqRes.ok) { const d = await reqRes.json(); setRequests(d.requests ?? []); }
    if (propsRes.ok) { const d = await propsRes.json(); setProperties(d.properties ?? []); }
    if (vendorRes.ok) { const d = await vendorRes.json(); setVendors(d.vendors ?? []); }
    setLoading(false);
  }, [statusFilter, priorityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this maintenance request?')) return;
    setDeleting(id);
    await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
    setDeleting(null);
    fetchData();
  }

  function copyVendorLink(token: string) {
    const url = `${window.location.origin}/maintenance/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        >
          <option value="">All statuses</option>
          <option value="reported">Reported</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        >
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <button
          onClick={fetchData}
          className="rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <RefreshCw size={14} />
        </button>
        <div className="ml-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> New Request
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No maintenance requests.</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-[var(--accent)] hover:underline">
            Report first issue →
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Issue</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Property</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Vendor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Cost</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const vendor = vendors.find(v => v.id === r.vendorId);
                const waUrl = vendor?.phone
                  ? buildVendorWhatsAppUrl(r, vendor, window.location.origin)
                  : null;
                return (
                  <tr key={r.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text-primary)]">{r.title}</p>
                      {r.category && (
                        <p className="text-xs text-[var(--text-tertiary)]">{CATEGORY_LABELS[r.category]}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {propertyMap[r.propertyId] ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={r.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      {vendor ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--text-secondary)]">{vendor.name}</span>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 p-1 rounded text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
                              title="Send WhatsApp"
                            >
                              <Phone size={12} />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[var(--text-secondary)]">
                      {r.actualCost != null
                        ? `₹${r.actualCost.toLocaleString('en-IN')}`
                        : r.estimatedCost != null
                        ? `~₹${r.estimatedCost.toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyVendorLink(r.accessToken)}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          title="Copy vendor link"
                        >
                          <Copy size={10} />
                          {copied === r.accessToken ? 'Copied!' : 'Link'}
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deleting === r.id}
                          className="p-1 rounded text-[var(--text-tertiary)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                          title="Delete request"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateModal
        open={showCreate}
        properties={properties}
        vendors={vendors}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); fetchData(); }}
      />
    </>
  );
}
