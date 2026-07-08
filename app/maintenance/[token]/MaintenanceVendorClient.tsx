'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Wrench } from 'lucide-react';
import type { MaintenanceRequest } from '@/src/domains/operations/types';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'URGENT',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-[var(--text-tertiary)]',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  urgent: 'text-rose-400 font-bold',
};

const STATUS_LABELS: Record<string, string> = {
  reported: 'Reported',
  assigned: 'Assigned to you',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  appliance: 'Appliance',
  structural: 'Structural',
  hvac: 'HVAC',
  pest: 'Pest Control',
  furniture: 'Furniture',
  other: 'Other',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function MaintenanceVendorClient({
  token,
  initialData,
}: {
  token: string;
  initialData: { request: MaintenanceRequest };
}) {
  const [request, setRequest] = useState(initialData.request);
  const [actualCost, setActualCost] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(
    request.status === 'resolved' || request.status === 'closed'
  );

  async function handleResolve() {
    setSubmitting(true);
    setError('');

    const res = await fetch(`/api/maintenance/token/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: notes || undefined,
        actualCost: actualCost ? Number(actualCost) : undefined,
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      const d = await res.json();
      setRequest(d.request);
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
          <h2 className="text-xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
            Marked as Resolved
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Thank you. The property manager has been notified.
          </p>
        </div>
        {request.resolvedAt && (
          <p className="text-xs text-[var(--text-tertiary)]">
            Resolved on {fmtDate(request.resolvedAt)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Issue card */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-[var(--text-tertiary)] shrink-0 mt-0.5" />
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
              {request.category ? CATEGORY_LABELS[request.category] : 'Maintenance'}
            </span>
          </div>
          <span className={`text-xs font-medium ${PRIORITY_COLORS[request.priority]}`}>
            {PRIORITY_LABELS[request.priority]}
          </span>
        </div>

        <h2 className="text-lg font-bold text-[var(--text-primary)] font-[family-name:var(--font-rajdhani)]">
          {request.title}
        </h2>

        {request.description && (
          <p className="text-sm text-[var(--text-secondary)] bg-[var(--bg-elevated)] rounded-lg p-3">
            {request.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
          <span>Status: <span className="text-[var(--text-secondary)]">{STATUS_LABELS[request.status] ?? request.status}</span></span>
          <span>Reported {fmtDate(request.createdAt)}</span>
        </div>

        {request.estimatedCost != null && (
          <div className="text-sm text-[var(--text-secondary)]">
            Estimated cost: <span className="font-medium text-[var(--text-primary)]">₹{request.estimatedCost.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>

      {/* Resolution form */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-4">
        <h3 className="font-semibold text-[var(--text-primary)]">Mark as Resolved</h3>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Actual Cost ₹ (optional)
          </label>
          <input
            type="number"
            value={actualCost}
            onChange={e => setActualCost(e.target.value)}
            placeholder="Enter total cost incurred"
            min="0"
            step="0.01"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Work Done / Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Describe what was fixed, parts replaced, or any follow-up needed…"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] resize-none"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
            {error}
          </div>
        )}

        <button
          onClick={handleResolve}
          disabled={submitting}
          className="w-full rounded-xl bg-[var(--accent)] py-4 text-base font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" /> Submitting…
            </span>
          ) : (
            'Mark as Resolved'
          )}
        </button>
      </div>

      <p className="text-center text-xs text-[var(--text-tertiary)] pb-4">
        This will notify the property manager that the issue has been fixed.
      </p>
    </div>
  );
}
