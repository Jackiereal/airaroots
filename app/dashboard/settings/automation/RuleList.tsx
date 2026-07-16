'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AutomationRule, AutomationTrigger, Condition, Action } from '@/src/domains/automation/types';
import { TRIGGER_LABELS, ACTION_LABELS } from '@/src/domains/automation/constants';

const OP_LABELS: Record<Condition['op'], string> = {
  eq: 'is',
  neq: 'is not',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'in',
};

function summarizeCondition(c: Condition): string {
  const field = c.field.replace(/^reservation\./, '');
  const value = Array.isArray(c.value) ? c.value.join(', ') : String(c.value);
  return `${field} ${OP_LABELS[c.op]} ${value}`;
}

function summarizeAction(a: Action): string {
  return ACTION_LABELS[a.type] ?? a.type;
}

export default function RuleList() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/automation/rules')
      .then((r) => r.json())
      .then((d) => setRules(d.rules ?? []))
      .catch(() => setError('Could not load automation rules'))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(rule: AutomationRule) {
    setSavingId(rule.id);
    setError('');
    const next = !rule.isActive;
    try {
      const res = await fetch(`/api/automation/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Failed to update rule');
        return;
      }
      setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, isActive: next } : r)));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p className="text-sm text-[var(--text-secondary)]">Loading…</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      {rules.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">No automation rules yet.</p>
      )}

      {rules.map((rule) => (
        <div
          key={rule.id}
          className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{rule.name}</h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                When: {TRIGGER_LABELS[rule.trigger as AutomationTrigger] ?? rule.trigger}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={rule.isActive}
              disabled={savingId === rule.id}
              onClick={() => toggle(rule)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                rule.isActive ? 'bg-[var(--accent)]' : 'bg-[var(--bg-elevated)]'
              }`}
            >
              {savingId === rule.id ? (
                <Loader2 size={12} className="animate-spin mx-auto text-[var(--text-secondary)]" />
              ) : (
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rule.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              )}
            </button>
          </div>

          {rule.conditions.length > 0 && (
            <p className="text-xs text-[var(--text-secondary)]">
              Only if:{' '}
              {rule.conditions.map((c, i) => (
                <span key={i} className="mr-1 rounded bg-[var(--bg-elevated)] px-1.5 py-0.5">
                  {summarizeCondition(c)}
                </span>
              ))}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[var(--text-tertiary)]">Then:</span>
            {rule.actions.map((a, i) => (
              <span
                key={i}
                className="rounded-lg bg-[var(--bg-base)] border border-[var(--border-color)] px-2 py-1 text-xs text-[var(--text-secondary)]"
              >
                {summarizeAction(a)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
