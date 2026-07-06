'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Sparkles, TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart3, Settings2 } from 'lucide-react';
type Recommendation = {
  id: string;
  title: string;
  description: string;
  reason: string;
  category: 'pricing' | 'marketing' | 'debt' | 'investment' | 'operations' | 'cashflow';
  confidence: 'high' | 'medium' | 'low';
  impact: string;
  action: string;
  source: 'rule' | 'ai';
};

const CATEGORY_META: Record<
  Recommendation['category'],
  { label: string; Icon: React.ElementType; color: string; bg: string }
> = {
  pricing: { label: 'Pricing', Icon: TrendingUp, color: 'text-sky-300', bg: 'bg-sky-950/40 border-sky-700/40' },
  marketing: { label: 'Marketing', Icon: BarChart3, color: 'text-purple-300', bg: 'bg-purple-950/40 border-purple-700/40' },
  debt: { label: 'Debt', Icon: TrendingDown, color: 'text-rose-300', bg: 'bg-rose-950/40 border-rose-700/40' },
  investment: { label: 'Investment', Icon: PiggyBank, color: 'text-amber-300', bg: 'bg-amber-950/40 border-amber-700/40' },
  operations: { label: 'Operations', Icon: Settings2, color: 'text-teal-300', bg: 'bg-teal-950/40 border-teal-700/40' },
  cashflow: { label: 'Cash Flow', Icon: Wallet, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10 border-[var(--accent)]/30' },
};

const CONFIDENCE_STYLE: Record<Recommendation['confidence'], string> = {
  high: 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/40',
  medium: 'bg-amber-950/60 text-amber-300 border border-amber-700/40',
  low: 'bg-rose-950/60 text-rose-300 border border-rose-700/40',
};

function RecCard({ rec }: { rec: Recommendation }) {
  const meta = CATEGORY_META[rec.category] ?? CATEGORY_META.operations;
  const { Icon } = meta;
  return (
    <div className={`rounded-xl border p-4 space-y-2.5 ${meta.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${meta.bg}`}>
          <Icon className={`h-4 w-4 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.color} bg-black/20`}>
              {meta.label}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${CONFIDENCE_STYLE[rec.confidence]}`}>
              {rec.confidence} confidence
            </span>
            {rec.source === 'ai' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-950/60 text-violet-300 border border-violet-700/40 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> AI
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{rec.title}</p>
        </div>
      </div>

      <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-10">{rec.reason}</p>

      {rec.impact && (
        <div className="ml-10 rounded-lg bg-black/20 border border-white/5 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-0.5">Expected Impact</p>
          <p className={`text-xs font-medium ${meta.color}`}>{rec.impact}</p>
        </div>
      )}
    </div>
  );
}

export default function RecommendationsPanel({ propertyId }: { propertyId: string }) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/${propertyId}/recommendations`);
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const d = await res.json() as { recommendations: Recommendation[]; generatedAt: string };
      setRecs(d.recommendations);
      setGeneratedAt(d.generatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }

  const ruleRecs = recs.filter((r) => r.source === 'rule');
  const aiRecs = recs.filter((r) => r.source === 'ai');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            AI Recommendation Engine
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Analyzes live financial data — rule-based + Claude AI strategic layer
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {loading ? 'Analyzing…' : recs.length === 0 ? 'Generate Recommendations' : 'Refresh'}
        </button>
      </div>

      {/* Generated timestamp */}
      {generatedAt && (
        <p className="text-[10px] text-[var(--text-secondary)]">
          Generated {new Date(generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 px-3 py-2">
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && recs.length === 0 && !error && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-10 text-center">
          <Sparkles className="h-8 w-8 text-[var(--accent)] mx-auto mb-3 opacity-60" />
          <p className="text-sm font-medium text-[var(--text-primary)]">No recommendations yet</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Click &ldquo;Generate Recommendations&rdquo; to analyze your financial data
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 animate-pulse h-24" />
          ))}
        </div>
      )}

      {/* Rule-based recommendations */}
      {!loading && ruleRecs.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-semibold">
            Rule-Based Insights
          </p>
          {ruleRecs.map((r) => (
            <RecCard key={r.id} rec={r} />
          ))}
        </div>
      )}

      {/* AI recommendations */}
      {!loading && aiRecs.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-violet-400" /> Claude AI Strategic Layer
          </p>
          {aiRecs.map((r) => (
            <RecCard key={r.id} rec={r} />
          ))}
        </div>
      )}
    </div>
  );
}
