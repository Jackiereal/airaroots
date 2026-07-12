'use client';

import { PLAN_LABELS, PLAN_PROPERTY_LIMITS, type Plan } from '@/src/domains/billing/constants';

const PLAN_ORDER: Plan[] = ['starter', 'growth', 'pro', 'enterprise'];

type Props = {
  code: 'plan_limit_reached' | 'trial_expired';
  message?: string;
  currentPlan?: Plan;
};

function limitLabel(plan: Plan): string {
  const limit = PLAN_PROPERTY_LIMITS[plan];
  return limit === null ? 'Unlimited properties' : `Up to ${limit} properties`;
}

// Informational only for now — plans are shown by property capacity, and
// upgrading is a "contact us" action. Self-service plan switching + pricing
// land with the checkout phase (no payment integration yet).
export default function PlanLimitPanel({ code, message, currentPlan }: Props) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
          {code === 'trial_expired' ? 'Your free trial has ended' : "You've reached your plan limit"}
        </h3>
        {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
      </div>

      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] divide-y divide-[var(--border-color)]">
        {PLAN_ORDER.map((plan) => {
          const isCurrent = plan === currentPlan;
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
              <span className="text-xs text-[var(--text-secondary)]">{limitLabel(plan)}</span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text-tertiary)]">
        Need a higher limit? Contact us to upgrade your plan.
      </p>
    </div>
  );
}
