'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Camera, Loader2, AlertTriangle } from 'lucide-react';
import type { HousekeepingTask, InventoryItem, ChecklistItem } from '@/src/domains/operations/types';

const TASK_TYPE_LABELS: Record<string, string> = {
  checkout_clean: 'Checkout Clean',
  mid_stay: 'Mid-stay Clean',
  inspection: 'Inspection',
  deep_clean: 'Deep Clean',
};

const CATEGORY_ORDER = ['general', 'bedroom', 'bathroom', 'kitchen', 'cleaning', 'check', 'security', 'documentation'];

function groupChecklist(checklist: ChecklistItem[]) {
  const groups: Record<string, ChecklistItem[]> = {};
  for (const item of checklist) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return CATEGORY_ORDER
    .filter(cat => groups[cat]?.length)
    .map(cat => ({ category: cat, items: groups[cat] }));
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function HousekeepingTaskClient({
  token,
  initialData,
}: {
  token: string;
  initialData: { task: HousekeepingTask; inventory: InventoryItem[] };
}) {
  const { task: initialTask, inventory } = initialData;
  const [task, setTask] = useState(initialTask);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialTask.checklist ?? []);
  const [notes, setNotes] = useState('');
  const [inventoryUsed, setInventoryUsed] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(initialTask.status === 'completed');
  const [error, setError] = useState('');

  const completed = checklist.filter(i => i.completed).length;
  const total = checklist.length;

  function toggleItem(idx: number) {
    setChecklist(prev => prev.map((item, i) =>
      i === idx ? { ...item, completed: !item.completed } : item
    ));
  }

  function setItemNotes(idx: number, n: string) {
    setChecklist(prev => prev.map((item, i) =>
      i === idx ? { ...item, notes: n } : item
    ));
  }

  function setInventoryQty(itemId: string, qty: number) {
    setInventoryUsed(prev => ({ ...prev, [itemId]: qty }));
  }

  async function handleComplete() {
    setSubmitting(true);
    setError('');

    const usedItems = Object.entries(inventoryUsed)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    const res = await fetch(`/api/hk/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checklist,
        notes: notes || undefined,
        inventoryUsed: usedItems.length > 0 ? usedItems : undefined,
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      const d = await res.json();
      setTask(d.task);
      setDone(true);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to submit. Please try again.');
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <CheckCircle2 size={56} className="text-[var(--accent)]" />
        <div>
          <h2 className="text-xl font-bold font-[family-name:var(--font-fraunces)] text-[var(--text-primary)]">
            Task Complete!
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Great work. The manager has been notified.
          </p>
        </div>
        {task.completedAt && (
          <p className="text-xs text-[var(--text-tertiary)]">
            Completed at {new Date(task.completedAt).toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}
      </div>
    );
  }

  const groups = groupChecklist(checklist);

  return (
    <div className="space-y-5">
      {/* Task header */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
          </span>
          {task.scheduledTime && (
            <span className="text-sm text-[var(--text-tertiary)]">⏰ {task.scheduledTime}</span>
          )}
        </div>
        <p className="text-lg font-bold text-[var(--text-primary)] font-[family-name:var(--font-fraunces)]">
          {fmtDate(task.scheduledDate)}
        </p>
        {task.notes && (
          <p className="text-sm text-[var(--text-secondary)] mt-2 bg-[var(--bg-elevated)] rounded-lg p-2">
            {task.notes}
          </p>
        )}

        {/* Progress bar */}
        {total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
              <span>{completed}/{total} items done</span>
              <span>{Math.round((completed / total) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${(completed / total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Checklist */}
      {groups.map(({ category, items }) => (
        <div key={category} className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] px-1 mb-2">
            {category}
          </h3>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {items.map((item, _) => {
              const globalIdx = checklist.findIndex(c => c === item);
              return (
                <div key={globalIdx} className="px-4 py-3">
                  <button
                    onClick={() => toggleItem(globalIdx)}
                    className="flex items-start gap-3 w-full text-left"
                  >
                    {item.completed ? (
                      <CheckCircle2 size={20} className="text-[var(--accent)] shrink-0 mt-0.5" />
                    ) : (
                      <Circle size={20} className="text-[var(--text-tertiary)] shrink-0 mt-0.5" />
                    )}
                    <span className={`text-sm ${item.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                      {item.item}
                    </span>
                  </button>
                  {item.completed && (
                    <input
                      type="text"
                      value={item.notes}
                      onChange={e => setItemNotes(globalIdx, e.target.value)}
                      placeholder="Add note (optional)…"
                      className="mt-2 ml-8 w-[calc(100%-2rem)] text-xs bg-[var(--bg-elevated)] rounded-lg px-3 py-1.5 text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Inventory used */}
      {inventory.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] px-1 mb-2">
            Supplies Used
          </h3>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--border-subtle)]">
            {inventory.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{item.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {item.quantity} {item.unit} in stock
                    {item.isLowStock && (
                      <span className="ml-1.5 text-amber-400">
                        <AlertTriangle size={10} className="inline" /> Low stock
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInventoryQty(item.id, Math.max(0, (inventoryUsed[item.id] ?? 0) - 1))}
                    className="w-7 h-7 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] text-lg leading-none"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-[var(--text-primary)]">
                    {inventoryUsed[item.id] ?? 0}
                  </span>
                  <button
                    onClick={() => setInventoryQty(item.id, (inventoryUsed[item.id] ?? 0) + 1)}
                    className="w-7 h-7 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] text-lg leading-none"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-tertiary)] px-1 mt-1">
            Only log what you actually used — this updates inventory automatically.
          </p>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] px-1 mb-2 block">
          Notes for Manager
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Any issues, missing items, damages, or feedback…"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] resize-none"
        />
      </div>

      {/* Photo upload hint */}
      <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex items-center gap-3">
        <Camera size={20} className="text-[var(--text-tertiary)] shrink-0" />
        <div>
          <p className="text-sm text-[var(--text-secondary)]">Take completion photos</p>
          <p className="text-xs text-[var(--text-tertiary)]">Checklist item: "Take completion photos" — mark it done above</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleComplete}
        disabled={submitting || task.status === 'completed'}
        className="w-full rounded-xl bg-[var(--accent)] py-4 text-base font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> Submitting…
          </span>
        ) : (
          'Mark Task Complete'
        )}
      </button>

      <p className="text-center text-xs text-[var(--text-tertiary)] pb-4">
        Once submitted, the manager will be notified and this task will be marked complete.
      </p>
    </div>
  );
}
