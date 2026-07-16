'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CommunicationTemplate, NotificationTrigger } from '@/src/domains/communication/types';
import { TRIGGER_LABELS, TRIGGER_VARS } from '@/src/domains/communication/constants';
import { renderTemplate } from '@/src/domains/communication/render';

// Sample values so the manager can preview how a template reads. Superset
// across all triggers; renderTemplate ignores keys a template doesn't use.
const PREVIEW_VARS: Record<string, string> = {
  staff_name: 'Ramesh',
  vendor_name: 'CoolAir Services',
  guest_name: 'Priya',
  property_name: 'Tamarind Villa',
  date: '2026-08-01',
  time: '11:00',
  task_type: 'checkout clean',
  checklist_url: 'https://airaroots.app/hk/abc123',
  priority: 'high',
  category: 'plumbing',
  title: 'Leaking tap in kitchen',
  request_url: 'https://airaroots.app/maintenance/xyz789',
  check_in: '2026-08-01',
  check_out: '2026-08-04',
  nights: '3',
};

export default function TemplateEditor() {
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/communication/templates')
      .then((r) => r.json())
      .then((d) => {
        const list: CommunicationTemplate[] = d.templates ?? [];
        setTemplates(list);
        setDrafts(Object.fromEntries(list.map((t) => [t.id, t.body])));
      })
      .catch(() => setError('Could not load templates'))
      .finally(() => setLoading(false));
  }, []);

  async function save(t: CommunicationTemplate) {
    setSavingId(t.id);
    setError('');
    try {
      const res = await fetch(`/api/communication/templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: drafts[t.id] }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Failed to save');
        return;
      }
      setSavedId(t.id);
      setTimeout(() => setSavedId(null), 2000);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p className="text-sm text-[var(--text-secondary)]">Loading…</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      {templates.map((t) => {
        const body = drafts[t.id] ?? '';
        const dirty = body !== t.body;
        const vars = TRIGGER_VARS[t.trigger as NotificationTrigger] ?? [];
        return (
          <div
            key={t.id}
            className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {TRIGGER_LABELS[t.trigger]}
              </h2>
              <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">{t.channel}</span>
            </div>

            <textarea
              value={body}
              onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />

            <p className="text-xs text-[var(--text-tertiary)]">
              Placeholders:{' '}
              {vars.map((v) => (
                <code key={v} className="mr-1 rounded bg-[var(--bg-elevated)] px-1 py-0.5">{`{{${v}}}`}</code>
              ))}
            </p>

            <div className="rounded-lg bg-[var(--bg-base)] border border-[var(--border-color)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">Preview</p>
              <p className="text-sm text-[var(--text-secondary)]">{renderTemplate(body, PREVIEW_VARS)}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!dirty || savingId === t.id}
                onClick={() => save(t)}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50"
              >
                {savingId === t.id && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
              {savedId === t.id && <span className="text-xs text-[var(--color-green)]">Saved</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
