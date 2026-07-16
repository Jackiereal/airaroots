'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PLAN_LABELS, PLAN_PROPERTY_LIMITS, type Plan } from '@/src/domains/billing/constants';

const PLAN_ORDER: Plan[] = ['starter', 'growth', 'pro', 'enterprise'];
// Plans a customer can self-subscribe to. Enterprise is custom / contact-us.
const SUBSCRIBABLE: Plan[] = ['starter', 'growth', 'pro'];

type Props = {
  code: 'plan_limit_reached' | 'trial_expired';
  message?: string;
  currentPlan?: Plan;
};

function limitLabel(plan: Plan): string {
  const limit = PLAN_PROPERTY_LIMITS[plan];
  return limit === null ? 'Unlimited properties' : `Up to ${limit} properties`;
}

// Rank so we only offer UPGRADES (a higher tier than the current plan).
const RANK: Record<Plan, number> = { starter: 0, growth: 1, pro: 2, enterprise: 3 };

export default function PlanLimitPanel({ code, message, currentPlan }: Props) {
  const [subscribing, setSubscribing] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  // Post-checkout: Razorpay redirects back with ?checkout=done. The webhook is
  // the source of truth, so we poll subscription status rather than trust the
  // redirect. `activating` shows the interim state.
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'done') return;

    setActivating(true);
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const res = await fetch('/api/billing/subscription');
        const d = await res.json();
        if (d.subscriptionStatus === 'active') {
          clearInterval(timer);
          window.location.href = window.location.pathname; // drop the query, reload
        }
      } catch {
        /* keep polling */
      }
      if (tries >= 20) clearInterval(timer); // ~1 min then give up quietly
    }, 3000);

    return () => clearInterval(timer);
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
        window.location.href = d.shortUrl; // Razorpay hosted checkout
        return;
      }
      setError('No checkout link returned');
      setSubscribing(null);
    } catch {
      setError('Could not start checkout');
      setSubscribing(null);
    }
  }

  if (activating) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--text-secondary)]">
          Activating your subscription… this usually takes a few seconds.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
          {code === 'trial_expired' ? 'Your free trial has ended' : "You've reached your plan limit"}
        </h3>
        {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
      </div>

      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] divide-y divide-[var(--border-color)]">
        {PLAN_ORDER.map((plan) => {
          const isCurrent = plan === currentPlan;
          const isUpgrade =
            SUBSCRIBABLE.includes(plan) && (!currentPlan || RANK[plan] > RANK[currentPlan]);
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
                {isUpgrade && (
                  <button
                    type="button"
                    disabled={subscribing !== null}
                    onClick={() => subscribe(plan)}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50"
                  >
                    {subscribing === plan && <Loader2 size={12} className="animate-spin" />}
                    Subscribe
                  </button>
                )}
                {plan === 'enterprise' && (
                  <span className="text-xs text-[var(--text-tertiary)]">Contact us</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        Subscriptions are billed monthly through Razorpay (UPI, cards, netbanking).
        For Enterprise, contact us.
      </p>
    </div>
  );
}
