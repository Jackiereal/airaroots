'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Phone, RefreshCw, User, Trash2 } from 'lucide-react';
import type {
  HousekeepingTask,
  HousekeepingStaff,
  HousekeepingTaskType,
  HousekeepingTaskStatus,
} from '@/src/domains/operations/types';

type Property = { id: string; name: string };

const TASK_TYPE_LABELS: Record<HousekeepingTaskType, string> = {
  checkout_clean: 'Checkout Clean',
  mid_stay: 'Mid-stay Clean',
  inspection: 'Inspection',
  deep_clean: 'Deep Clean',
};

const TASK_TYPE_COLORS: Record<HousekeepingTaskType, string> = {
  checkout_clean: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  mid_stay: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  inspection: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  deep_clean: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const COLUMNS: { status: HousekeepingTaskStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Pending', color: 'text-[var(--text-tertiary)]' },
  { status: 'assigned', label: 'Assigned', color: 'text-amber-400' },
  { status: 'in_progress', label: 'In Progress', color: 'text-blue-400' },
  { status: 'completed', label: 'Completed', color: 'text-[var(--accent)]' },
];

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
}

function buildWhatsAppUrl(task: HousekeepingTask, staff: HousekeepingStaff, baseUrl: string) {
  const date = fmtDate(task.scheduledDate);
  const time = task.scheduledTime ?? '14:00';
  const type = TASK_TYPE_LABELS[task.taskType];
  const taskUrl = `${baseUrl}/hk/${task.accessToken}`;
  const msg = `Hi ${staff.name}, you have a ${type} task scheduled for ${date} at ${time}.\n\nOpen task: ${taskUrl}`;
  return `https://wa.me/${staff.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  propertyName,
  onAssign,
  onDelete,
}: {
  task: HousekeepingTask;
  propertyName: string;
  onAssign: (task: HousekeepingTask) => void;
  onDelete: (id: string) => void;
}) {
  const waUrl =
    task.staff?.phone
      ? buildWhatsAppUrl(task, task.staff, window.location.origin)
      : null;

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 space-y-2 hover:border-[var(--border-color)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-[var(--text-secondary)] leading-tight">{propertyName}</span>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium ${TASK_TYPE_COLORS[task.taskType]}`}>
          {TASK_TYPE_LABELS[task.taskType]}
        </span>
      </div>

      <div className="text-xs text-[var(--text-tertiary)]">
        {fmtDate(task.scheduledDate)}{task.scheduledTime ? ` · ${task.scheduledTime}` : ''}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {task.staff ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <User size={12} className="text-[var(--text-tertiary)] shrink-0" />
            <span className="text-xs text-[var(--text-secondary)] truncate">{task.staff.name}</span>
          </div>
        ) : (
          <button
            onClick={() => onAssign(task)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            + Assign
          </button>
        )}

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
          >
            <Phone size={10} /> WhatsApp
          </a>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        {task.customPrice != null ? (
          <span className="text-xs text-[var(--text-tertiary)]">₹{task.customPrice.toLocaleString('en-IN')}</span>
        ) : <span />}
        <button
          onClick={() => {
            if (confirm('Delete this task?')) onDelete(task.id);
          }}
          className="p-1 rounded text-[var(--text-tertiary)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Delete task"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Create Task Modal ─────────────────────────────────────────────────────────

function CreateTaskModal({
  open,
  properties,
  staffList,
  onClose,
  onSuccess,
}: {
  open: boolean;
  properties: Property[];
  staffList: HousekeepingStaff[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    propertyId: '',
    taskType: 'checkout_clean' as HousekeepingTaskType,
    scheduledDate: today,
    scheduledTime: '14:00',
    assignedTo: '',
    customPrice: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.propertyId) { setError('Select a property'); return; }
    setSaving(true);
    setError('');
    const res = await fetch('/api/housekeeping/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: form.propertyId,
        taskType: form.taskType,
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime || undefined,
        assignedTo: form.assignedTo || undefined,
        customPrice: form.customPrice ? Number(form.customPrice) : undefined,
        notes: form.notes || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSuccess();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to create task');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl">
        <div className="border-b border-[var(--border-color)] px-5 py-4">
          <h2 className="font-semibold text-[var(--text-primary)]">New Housekeeping Task</h2>
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
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Task Type</label>
            <select
              value={form.taskType}
              onChange={e => setForm(f => ({ ...f, taskType: e.target.value as HousekeepingTaskType }))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Date</label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                required
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Time</label>
              <input
                type="time"
                value={form.scheduledTime}
                onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Assign Staff (optional)</label>
            <select
              value={form.assignedTo}
              onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">Unassigned</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Custom Price (₹, optional)</label>
            <input
              type="number"
              value={form.customPrice}
              onChange={e => setForm(f => ({ ...f, customPrice: e.target.value }))}
              placeholder="Leave blank for standard rate"
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
              placeholder="Any special instructions…"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] resize-none"
            />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Assign Staff Modal ────────────────────────────────────────────────────────

function AssignModal({
  task,
  staffList,
  onClose,
  onSuccess,
}: {
  task: HousekeepingTask;
  staffList: HousekeepingStaff[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [staffId, setStaffId] = useState(task.assignedTo ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/housekeeping/tasks/${task.id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId }),
    });
    setSaving(false);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl p-5 space-y-4">
        <h2 className="font-semibold text-[var(--text-primary)]">Assign Staff</h2>
        <select
          value={staffId}
          onChange={e => setStaffId(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="">Unassigned</option>
          {staffList.map(s => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Board ────────────────────────────────────────────────────────────────

export function HousekeepingBoard() {
  const today = new Date().toISOString().split('T')[0];
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [staffList, setStaffList] = useState<HousekeepingStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(today);
  const [propertyId, setPropertyId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [assignTask, setAssignTask] = useState<HousekeepingTask | null>(null);

  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p.name]));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (propertyId) params.set('propertyId', propertyId);

    const [tasksRes, propsRes, staffRes] = await Promise.all([
      fetch(`/api/housekeeping/tasks?${params}`),
      fetch('/api/properties'),
      fetch('/api/housekeeping/staff?activeOnly=true'),
    ]);

    if (tasksRes.ok) {
      const d = await tasksRes.json();
      setTasks(d.tasks ?? []);
    }
    if (propsRes.ok) {
      const d = await propsRes.json();
      setProperties(d.properties ?? []);
    }
    if (staffRes.ok) {
      const d = await staffRes.json();
      setStaffList(d.staff ?? []);
    }
    setLoading(false);
  }, [date, propertyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDeleteTask(id: string) {
    await fetch(`/api/housekeeping/tasks/${id}`, { method: 'DELETE' });
    fetchData();
  }

  const tasksByStatus = COLUMNS.reduce<Record<string, HousekeepingTask[]>>((acc, col) => {
    acc[col.status] = tasks.filter(t => t.status === col.status);
    return acc;
  }, {});

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        />
        <select
          value={propertyId}
          onChange={e => setPropertyId(e.target.value)}
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
        >
          <option value="">All properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button
          onClick={fetchData}
          className="rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard/housekeeping/staff"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Manage Staff
          </Link>
          {propertyId && (
            <Link
              href={`/dashboard/housekeeping/checklist/${propertyId}`}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Checklist
            </Link>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> New Task
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 min-h-[60vh]">
          {COLUMNS.map(col => {
            const colTasks = tasksByStatus[col.status] ?? [];
            return (
              <div key={col.status} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-tertiary)]">
                    {colTasks.length}
                  </span>
                </div>

                {colTasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-center">
                    <p className="text-xs text-[var(--text-tertiary)]">No tasks</p>
                  </div>
                ) : (
                  colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      propertyName={propertyMap[task.propertyId] ?? task.propertyId}
                      onAssign={setAssignTask}
                      onDelete={handleDeleteTask}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateTaskModal
        open={showCreate}
        properties={properties}
        staffList={staffList}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); fetchData(); }}
      />

      {assignTask && (
        <AssignModal
          task={assignTask}
          staffList={staffList}
          onClose={() => setAssignTask(null)}
          onSuccess={() => { setAssignTask(null); fetchData(); }}
        />
      )}
    </>
  );
}
