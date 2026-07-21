'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PLAN_LABELS, PLAN_PROPERTY_LIMITS, type Plan } from '@/src/domains/billing/constants';

// Two tracks shown side by side: Individual (Solo/Small, 1–3 properties) and
// PMC (Growth/Pro, 4–25 properties). Enterprise (25+) is custom / contact-us.
const INDIVIDUAL_TIERS: Plan[] = ['solo', 'small'];
const PMC_TIERS: Plan[] = ['growth', 'pro', 'enterprise'];
// Plans a customer can self-subscribe to. Enterprise is custom / contact-us.
const SUBSCRIBABLE: Plan[] = ['solo', 'small', 'growth', 'pro'];

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
const RANK: Record<Plan, number> = { solo: 0, small: 1, growth: 2, pro: 3, enterprise: 4 };

const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js';

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  handler?: (response: unknown) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};

type RazorpayInstance = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

// Load Razorpay checkout.js once, resolving when window.Razorpay is available.
function loadCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(!!window.Razorpay));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_JS;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

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

      // Preferred: open the Razorpay checkout modal so its success handler can
      // redirect back to the app. Falls back to the hosted short_url page (which
      // can't redirect back) only if checkout.js fails to load.
      const ready = await loadCheckoutScript();
      if (ready && window.Razorpay && d.subscriptionId && d.keyId) {
        const rzp = new window.Razorpay({
          key: d.keyId,
          subscription_id: d.subscriptionId,
          name: 'Hostezy',
          description: `${PLAN_LABELS[plan]} plan`,
          handler: () => {
            // Payment authorised. The webhook is the source of truth; the return
            // URL just puts the panel into its polling ("activating…") state.
            window.location.href = `${window.location.pathname}?checkout=done`;
          },
          modal: { ondismiss: () => setSubscribing(null) },
          theme: { color: '#16a34a' },
        });
        rzp.open();
        return;
      }

      if (d.shortUrl) {
        window.location.href = d.shortUrl; // fallback: hosted page (no redirect back)
        return;
      }
      setError('Could not start checkout');
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
        <h3 className="text-base font-bold font-[family-name:var(--font-fraunces)] text-[var(--text-primary)]">
          {code === 'trial_expired' ? 'Your free trial has ended' : "You've reached your plan limit"}
        </h3>
        {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
      </div>

      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
          Individual owners
        </p>
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] divide-y divide-[var(--border-color)]">
          {INDIVIDUAL_TIERS.map((plan) => renderPlanRow(plan))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
          Property management companies
        </p>
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] divide-y divide-[var(--border-color)]">
          {PMC_TIERS.map((plan) => renderPlanRow(plan))}
        </div>
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        Subscriptions are billed monthly through Razorpay (UPI, cards, netbanking).
        For Enterprise, contact us.
      </p>
    </div>
  );

  function renderPlanRow(plan: Plan) {
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
            <a
              href="mailto:teja.jackie@gmail.com?subject=Hostezy%20Enterprise%20plan"
              className="text-xs font-medium text-[var(--accent)]"
            >
              Contact us
            </a>
          )}
        </span>
      </div>
    );
  }
}
