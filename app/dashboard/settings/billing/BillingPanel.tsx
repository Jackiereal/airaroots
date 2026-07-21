'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { PLAN_LABELS, PLAN_PROPERTY_LIMITS, type Plan, type SubscriptionStatus } from '@/src/domains/billing/constants';

const ALL_TIERS: Plan[] = ['solo', 'small', 'growth', 'pro'];
const RANK: Record<Plan, number> = { solo: 0, small: 1, growth: 2, pro: 3, enterprise: 4 };

type SubscriptionInfo = {
  plan: Plan | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscription: { status: string; currentPeriodEnd: string | null } | null;
};

function limitLabel(plan: Plan): string {
  const limit = PLAN_PROPERTY_LIMITS[plan];
  return limit === null ? 'Unlimited properties' : limit === 1 ? '1 property' : `Up to ${limit} properties`;
}

function statusLabel(status: SubscriptionStatus | null): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  switch (status) {
    case 'active':
      return { text: 'Active', tone: 'ok' };
    case 'trialing':
      return { text: 'Free trial', tone: 'ok' };
    case 'past_due':
      return { text: 'Payment past due', tone: 'bad' };
    case 'cancelled':
      return { text: 'Cancelled', tone: 'warn' };
    default:
      return { text: 'Unknown', tone: 'warn' };
  }
}

export default function BillingPanel() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<Plan | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/billing/subscription');
      const d = await res.json();
      setInfo(d);
    } catch {
      setError('Could not load billing info');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function subscribe(plan: Plan) {
    setSubscribing(plan);
    setError('');
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? 'Could not start checkout');
        setSubscribing(null);
        return;
      }
      if (d.shortUrl) {
        window.location.href = d.shortUrl;
        return;
      }
      setError('Could not start checkout');
      setSubscribing(null);
    } catch {
      setError('Could not start checkout');
      setSubscribing(null);
    }
  }

  async function cancel() {
    setCancelling(true);
    setError('');
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? 'Could not cancel subscription');
        setCancelling(false);
        return;
      }
      setConfirmCancel(false);
      await load();
    } catch {
      setError('Could not cancel subscription');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--text-secondary)]">Loading billing info…</p>
      </div>
    );
  }

  const currentPlan = info?.plan ?? null;
  const status = statusLabel(info?.subscriptionStatus ?? null);
  const hasBillableSubscription = ['authenticated', 'active', 'pending', 'halted'].includes(
    info?.subscription?.status ?? ''
  );

  return (
    <div className="space-y-6">
      {info?.subscriptionStatus === 'past_due' && (
        <div className="rounded-xl border p-4 flex items-start gap-3" style={{ borderColor: 'var(--color-red)', background: 'color-mix(in srgb, var(--color-red) 8%, transparent)' }}>
          <AlertTriangle size={18} className="text-[var(--color-red)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Your last payment failed</p>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Update your payment method with Razorpay or retry the charge to avoid losing access when your grace period ends.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--text-tertiary)]">Current plan</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {currentPlan ? PLAN_LABELS[currentPlan] : '—'}
            </p>
            {currentPlan && <p className="text-sm text-[var(--text-secondary)]">{limitLabel(currentPlan)}</p>}
          </div>
          <span
            className="rounded px-2 py-1 text-xs font-medium"
            style={{
              color: status.tone === 'ok' ? 'var(--accent)' : status.tone === 'bad' ? 'var(--color-red)' : 'var(--text-tertiary)',
              background: status.tone === 'ok' ? 'var(--accent-muted)' : status.tone === 'bad' ? 'color-mix(in srgb, var(--color-red) 15%, transparent)' : 'var(--bg-elevated)',
            }}
          >
            {status.text}
          </span>
        </div>

        {hasBillableSubscription && (
          <div className="pt-2 border-t border-[var(--border-color)]">
            {!confirmCancel ? (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="text-sm font-medium text-[var(--color-red)]"
              >
                Cancel subscription
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  Cancel now? You'll drop to the Solo plan once processed.
                </p>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={cancel}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--color-red)] px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {cancelling && <Loader2 size={12} className="animate-spin" />}
                  Confirm cancel
                </button>
                <button type="button" onClick={() => setConfirmCancel(false)} className="text-xs text-[var(--text-tertiary)]">
                  Keep subscription
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Change plan</p>
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] divide-y divide-[var(--border-color)]">
          {ALL_TIERS.map((plan) => {
            const isCurrent = plan === currentPlan;
            const isUpgrade = !currentPlan || RANK[plan] > RANK[currentPlan];
            return (
              <div key={plan} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)]">{PLAN_LABELS[plan]}</span>
                  {isCurrent && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)] bg-[var(--accent-muted)]">
                      Current
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-secondary)]">{limitLabel(plan)}</span>
                  {!isCurrent && isUpgrade && (
                    <button
                      type="button"
                      disabled={subscribing !== null}
                      onClick={() => subscribe(plan)}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50"
                    >
                      {subscribing === plan && <Loader2 size={12} className="animate-spin" />}
                      Upgrade
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
