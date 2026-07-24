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
import Picker from '@/components/ui/Picker';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { renderTemplate } from '@/src/domains/communication/render';
import type { CommunicationTemplate } from '@/src/domains/communication/types';

type Property = { id: string; name: string };

const TASK_TYPE_LABELS: Record<HousekeepingTaskType, string> = {
  checkout_clean: 'Checkout Clean',
  mid_stay: 'Mid-stay Clean',
  inspection: 'Inspection',
  deep_clean: 'Deep Clean',
};

const TASK_TYPE_BADGE_VARIANT: Record<HousekeepingTaskType, 'profit' | 'violet' | 'amber' | 'rose'> = {
  checkout_clean: 'profit',
  mid_stay: 'violet',
  inspection: 'amber',
  deep_clean: 'rose',
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

function buildWhatsAppUrl(
  task: HousekeepingTask,
  staff: HousekeepingStaff,
  baseUrl: string,
  propertyName: string,
  template?: string,
) {
  const date = fmtDate(task.scheduledDate);
  const time = task.scheduledTime ?? '14:00';
  const type = TASK_TYPE_LABELS[task.taskType];
  const taskUrl = `${baseUrl}/hk/${task.accessToken}`;
  const vars = {
    staff_name: staff.name,
    property_name: propertyName,
    date,
    time,
    task_type: type,
    checklist_url: taskUrl,
  };
  const msg = template
    ? renderTemplate(template, vars)
    : `Hi ${staff.name}, you have a ${type} task scheduled for ${date} at ${time}.\n\nOpen task: ${taskUrl}`;
  return `https://wa.me/${staff.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

function buildReminderUrl(
  task: HousekeepingTask,
  staff: HousekeepingStaff,
  baseUrl: string,
  propertyName = '',
  template?: string,
) {
  const time = task.scheduledTime ?? '14:00';
  const taskUrl = `${baseUrl}/hk/${task.accessToken}`;
  const vars = { staff_name: staff.name, property_name: propertyName, time, checklist_url: taskUrl };
  const msg = template
    ? renderTemplate(template, vars)
    : `Reminder: Property cleaning today by ${time}. Checklist: ${taskUrl}`;
  return `https://wa.me/${staff.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  propertyName,
  assignmentTemplate,
  onAssign,
  onDelete,
}: {
  task: HousekeepingTask;
  propertyName: string;
  assignmentTemplate?: string;
  onAssign: (task: HousekeepingTask) => void;
  onDelete: (id: string) => void;
}) {
  const waUrl =
    task.staff?.phone
      ? buildWhatsAppUrl(task, task.staff, window.location.origin, propertyName, assignmentTemplate)
      : null;

  return (
    <Card padding="compact" className="space-y-2 hover:border-[var(--border-strong)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-[var(--text-secondary)] leading-tight">{propertyName}</span>
        <Badge variant={TASK_TYPE_BADGE_VARIANT[task.taskType]} className="shrink-0">
          {TASK_TYPE_LABELS[task.taskType]}
        </Badge>
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
    </Card>
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

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) onClose(); }} title="New Housekeeping Task">
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Property</label>
            <Picker
              value={form.propertyId}
              onChange={v => setForm(f => ({ ...f, propertyId: v }))}
              options={properties.map(p => ({ value: p.id, label: p.name }))}
              placeholder="Select property…"
              className="w-full"
              searchable
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Task Type</label>
            <Picker
              value={form.taskType}
              onChange={v => setForm(f => ({ ...f, taskType: v as HousekeepingTaskType }))}
              options={Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              className="w-full"
            />
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
            <Picker
              value={form.assignedTo}
              onChange={v => setForm(f => ({ ...f, assignedTo: v }))}
              options={staffList.filter(s => s.propertyId === form.propertyId).map(s => ({
                value: s.id, label: s.name, description: s.phone,
              }))}
              placeholder="Unassigned"
              className="w-full"
            />
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
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              {saving ? 'Creating…' : 'Create Task'}
            </Button>
          </div>
        </form>
    </Modal>
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
    <Modal open onOpenChange={(o) => { if (!o) onClose(); }} title="Assign Staff">
      <div className="p-5 space-y-4">
        <Picker
          value={staffId}
          onChange={setStaffId}
          options={staffList.filter(s => s.propertyId === task.propertyId).map(s => ({
            value: s.id, label: s.name, description: s.phone,
          }))}
          placeholder="Unassigned"
          className="w-full"
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} loading={saving} className="flex-1">
            {saving ? 'Saving…' : 'Assign'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Reminders Banner ────────────────────────────────────────────────────────────
// No server-side auto-send is possible without WhatsApp Business API access, so
// this surfaces today's un-reminded, staff-assigned tasks for a manager to click
// through manually. Each click opens wa.me and marks the reminder sent.

function RemindersBanner({ onDismissOne }: { onDismissOne: () => void }) {
  const [reminders, setReminders] = useState<HousekeepingTask[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/housekeeping/tasks/reminders')
      .then(res => (res.ok ? res.json() : { tasks: [] }))
      .then(d => { setReminders(d.tasks ?? []); setLoaded(true); });
  }, []);

  async function handleSent(task: HousekeepingTask) {
    await fetch(`/api/housekeeping/tasks/${task.id}/remind`, { method: 'POST' });
    setReminders(prev => prev.filter(t => t.id !== task.id));
    onDismissOne();
  }

  if (!loaded || reminders.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-2">
        {reminders.length} task{reminders.length > 1 ? 's' : ''} today need a reminder sent
      </p>
      <div className="flex flex-wrap gap-2">
        {reminders.map(task => {
          if (!task.staff?.phone) return null;
          const url = buildReminderUrl(task, task.staff, window.location.origin);
          return (
            <a
              key={task.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleSent(task)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-amber-500/10 transition-colors"
            >
              <Phone size={11} className="text-[#25D366]" />
              Remind {task.staff.name}
            </a>
          );
        })}
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
  const [showAllUpcoming, setShowAllUpcoming] = useState(true);
  const [propertyId, setPropertyId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [assignTask, setAssignTask] = useState<HousekeepingTask | null>(null);
  const [assignmentTemplate, setAssignmentTemplate] = useState<string | undefined>();

  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p.name]));

  // Load the org's housekeeping-assignment message template (if customized)
  // to render into the WhatsApp links. Falls back to the built-in text.
  useEffect(() => {
    fetch('/api/communication/templates')
      .then((r) => r.json())
      .then((d) => {
        const list: CommunicationTemplate[] = d.templates ?? [];
        const tpl = list.find((t) => t.trigger === 'housekeeping_assignment' && t.isActive);
        if (tpl) setAssignmentTemplate(tpl.body);
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (date && !showAllUpcoming) params.set('date', date);
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
  }, [date, showAllUpcoming, propertyId]);

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
      <RemindersBanner onDismissOne={fetchData} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          disabled={showAllUpcoming}
          className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] disabled:opacity-50"
        />
        <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={showAllUpcoming}
            onChange={e => setShowAllUpcoming(e.target.checked)}
          />
          All upcoming
        </label>
        <Picker
          value={propertyId}
          onChange={setPropertyId}
          options={properties.map(p => ({ value: p.id, label: p.name }))}
          placeholder="All properties"
          className="min-w-[9rem]"
          searchable
        />

        <Button variant="secondary" onClick={fetchData} title="Refresh" className="min-h-11 min-w-11">
          <RefreshCw size={14} />
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/housekeeping/staff"
            className="min-h-11 inline-flex items-center px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            Manage Staff
          </Link>
          {propertyId && (
            <Link
              href={`/dashboard/housekeeping/checklist/${propertyId}`}
              className="min-h-11 inline-flex items-center px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              Checklist
            </Link>
          )}
          <Button onClick={() => setShowCreate(true)} className="min-h-11">
            <Plus size={15} /> New Task
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[60vh]">
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
                      assignmentTemplate={assignmentTemplate}
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
