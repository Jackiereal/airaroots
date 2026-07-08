'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, RotateCcw, GripVertical } from 'lucide-react';
import type { ChecklistItem } from '@/src/domains/operations/types';

const CATEGORIES = [
  'general', 'bedroom', 'bathroom', 'kitchen', 'cleaning', 'check', 'security', 'documentation',
];

const CATEGORY_ORDER = CATEGORIES;

function groupChecklist(items: ChecklistItem[]) {
  const groups: Record<string, ChecklistItem[]> = {};
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return CATEGORY_ORDER.filter(c => groups[c]?.length).map(c => ({ category: c, items: groups[c] }));
}

export function ChecklistEditor({
  propertyId,
  propertyName,
  initialItems,
  isCustom,
}: {
  propertyId: string;
  propertyName: string;
  initialItems: ChecklistItem[];
  isCustom: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ChecklistItem[]>(
    initialItems.map(i => ({ ...i, completed: false, notes: '' }))
  );
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    setItems(prev => [...prev, { item: text, category: newCategory, completed: false, notes: '' }]);
    setNewItem('');
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItemText(idx: number, text: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, item: text } : it));
  }

  function updateItemCategory(idx: number, category: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, category } : it));
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    setItems(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  async function handleSave() {
    if (items.length === 0) { setError('Add at least one item'); return; }
    setSaving(true);
    setError('');
    const res = await fetch(`/api/housekeeping/templates/${propertyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to save');
    }
  }

  async function handleReset() {
    if (!confirm('Reset to global default checklist? Custom items will be lost.')) return;
    setResetting(true);
    await fetch(`/api/housekeeping/templates/${propertyId}`, { method: 'DELETE' });
    setResetting(false);
    router.refresh();
  }

  const groups = groupChecklist(items);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
            Checklist — {propertyName}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {isCustom
              ? 'Custom checklist for this property'
              : 'Using global default — save to create a property-specific checklist'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCustom && (
            <button
              onClick={handleReset}
              disabled={resetting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-50"
            >
              {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Reset to default
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saved ? 'Saved!' : 'Save Checklist'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Items by category */}
      {groups.length > 0 && (
        <div className="space-y-4">
          {groups.map(({ category, items: groupItems }) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-2 px-1">
                {category}
              </h3>
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                {groupItems.map((item) => {
                  const globalIdx = items.indexOf(item);
                  return (
                    <div key={globalIdx} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => moveItem(globalIdx, -1)}
                          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] leading-none"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveItem(globalIdx, 1)}
                          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] leading-none"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
                      <GripVertical size={14} className="text-[var(--text-tertiary)] shrink-0" />
                      <input
                        type="text"
                        value={item.item}
                        onChange={e => updateItemText(globalIdx, e.target.value)}
                        className="flex-1 text-sm text-[var(--text-primary)] bg-transparent outline-none"
                      />
                      <select
                        value={item.category}
                        onChange={e => updateItemCategory(globalIdx, e.target.value)}
                        className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 shrink-0"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button
                        onClick={() => removeItem(globalIdx)}
                        className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No items yet. Add your first checklist item below.</p>
        </div>
      )}

      {/* Add new item */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Add Item</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="e.g. Check smoke detector batteries"
            className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-2 text-sm text-[var(--text-primary)]"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Plus size={15} /> Add
          </button>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-2">Press Enter or click Add. Changes only save when you click Save Checklist.</p>
      </div>

      <p className="text-xs text-[var(--text-tertiary)] text-center pb-2">
        {items.length} item{items.length !== 1 ? 's' : ''} · This checklist will be used for all new tasks at {propertyName}.
      </p>
    </div>
  );
}
