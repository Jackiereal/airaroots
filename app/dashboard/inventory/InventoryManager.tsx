'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, AlertTriangle, RefreshCw, Pencil, PackagePlus } from 'lucide-react';
import type { InventoryItem, InventoryCategory, InventoryTransactionType } from '@/src/domains/operations/types';

type Property = { id: string; name: string };

const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  linen: 'Linen',
  toiletry: 'Toiletry',
  kitchen: 'Kitchen',
  cleaning: 'Cleaning',
  electronics: 'Electronics',
  furniture: 'Furniture',
  other: 'Other',
};

// ── Add Item Modal ────────────────────────────────────────────────────────────

function AddItemModal({
  properties,
  onClose,
  onSuccess,
}: {
  properties: Property[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    propertyId: '',
    name: '',
    category: '' as InventoryCategory | '',
    unit: 'pcs',
    quantity: '0',
    reorderLevel: '5',
    costPerUnit: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.propertyId || !form.name.trim()) { setError('Property and name required'); return; }
    setSaving(true);
    setError('');
    const res = await fetch(`/api/properties/${form.propertyId}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        category: form.category || undefined,
        unit: form.unit || 'pcs',
        quantity: Number(form.quantity),
        reorderLevel: Number(form.reorderLevel),
        costPerUnit: form.costPerUnit ? Number(form.costPerUnit) : undefined,
        notes: form.notes || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) { onSuccess(); }
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to add item');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="border-b border-[var(--border-color)] px-5 py-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Add Inventory Item</h2>
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
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Item Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              placeholder="e.g. Shampoo sachets"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as InventoryCategory | '' }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="">None</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="pcs, litres, kg…"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Current Quantity</label>
              <input
                type="number"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                min="0"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Reorder Level</label>
              <input
                type="number"
                value={form.reorderLevel}
                onChange={e => setForm(f => ({ ...f, reorderLevel: e.target.value }))}
                min="0"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Cost per Unit ₹ (optional)</label>
            <input
              type="number"
              value={form.costPerUnit}
              onChange={e => setForm(f => ({ ...f, costPerUnit: e.target.value }))}
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Restock Modal ─────────────────────────────────────────────────────────────

function RestockModal({
  item,
  onClose,
  onSuccess,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    type: 'restock' as InventoryTransactionType,
    quantity: '',
    cost: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.quantity || Number(form.quantity) <= 0) { setError('Quantity must be > 0'); return; }
    setSaving(true);
    setError('');
    const res = await fetch(`/api/properties/${item.propertyId}/inventory/${item.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: form.type,
        quantity: Number(form.quantity),
        cost: form.cost ? Number(form.cost) : undefined,
        notes: form.notes || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) { onSuccess(); }
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to log transaction');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl">
        <div className="border-b border-[var(--border-color)] px-5 py-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Log Transaction</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{item.name} · current: {item.quantity} {item.unit}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as InventoryTransactionType }))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="restock">Restock (add)</option>
              <option value="used">Used (remove)</option>
              <option value="damaged">Damaged (remove)</option>
              <option value="audit">Audit (set quantity)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Quantity ({item.unit})</label>
            <input
              type="number"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              required
              min="1"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          {form.type === 'restock' && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Total Cost ₹ (optional)</label>
              <input
                type="number"
                value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Saving…' : 'Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);

  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p.name]));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const propsRes = await fetch('/api/properties');
    if (propsRes.ok) {
      const d = await propsRes.json();
      setProperties(d.properties ?? []);

      const targetProperties: Property[] = propertyFilter
        ? (d.properties ?? []).filter((p: Property) => p.id === propertyFilter)
        : (d.properties ?? []);

      const allItems: InventoryItem[] = [];
      await Promise.all(
        targetProperties.map(async (p: Property) => {
          const r = await fetch(`/api/properties/${p.id}/inventory`);
          if (r.ok) {
            const inv = await r.json();
            allItems.push(...(inv.items ?? []));
          }
        })
      );
      setItems(allItems);
    }
    setLoading(false);
  }, [propertyFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const lowStockItems = items.filter(i => i.isLowStock);
  const byProperty = properties.reduce<Record<string, InventoryItem[]>>((acc, p) => {
    acc[p.id] = items.filter(i => i.propertyId === p.id);
    return acc;
  }, {});

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={propertyFilter}
          onChange={e => setPropertyFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        >
          <option value="">All properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button
          onClick={fetchData}
          className="rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <RefreshCw size={14} />
        </button>
        <div className="ml-auto">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* Low stock alert banner */}
      {lowStockItems.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-400">
              {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} low on stock
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              {lowStockItems.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No inventory items yet.</p>
          <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-[var(--accent)] hover:underline">
            Add first item →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {properties
            .filter(p => !propertyFilter || p.id === propertyFilter)
            .map(p => {
              const propItems = byProperty[p.id] ?? [];
              if (propItems.length === 0) return null;
              return (
                <div key={p.id}>
                  <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">{propertyMap[p.id]}</h2>
                  <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Item</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Category</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Stock</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Reorder At</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Cost/Unit</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {propItems.map(item => (
                          <tr
                            key={item.id}
                            className={`border-b border-[var(--border-subtle)] transition-colors ${
                              item.isLowStock ? 'bg-amber-500/5' : 'hover:bg-[var(--bg-surface)]/60'
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {item.isLowStock && (
                                  <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                                )}
                                <span className="font-medium text-[var(--text-primary)]">{item.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-[var(--text-tertiary)]">
                              {item.category ? CATEGORY_LABELS[item.category] : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-medium text-sm ${item.isLowStock ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>
                                {item.quantity}
                              </span>
                              <span className="text-xs text-[var(--text-tertiary)] ml-1">{item.unit}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-[var(--text-tertiary)]">
                              {item.reorderLevel} {item.unit}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-[var(--text-secondary)]">
                              {item.costPerUnit != null ? `₹${item.costPerUnit}` : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <button
                                onClick={() => setRestockItem(item)}
                                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                              >
                                <PackagePlus size={10} /> Update
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {showAdd && (
        <AddItemModal
          properties={properties}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); fetchData(); }}
        />
      )}
      {restockItem && (
        <RestockModal
          item={restockItem}
          onClose={() => setRestockItem(null)}
          onSuccess={() => { setRestockItem(null); fetchData(); }}
        />
      )}
    </>
  );
}
