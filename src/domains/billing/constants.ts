// Billing plan definitions (Phase 8 minimal scope).
//
// These MUST stay in sync with the SQL CHECK constraints on the
// organizations table (migration 020) — plan and subscription_status
// values are duplicated there. Property limits come from the pricing
// tiers in docs/01 Vision/01 Executive Summary.md.

export type Plan = 'starter' | 'growth' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

// Max properties per plan. null = unlimited.
export const PLAN_PROPERTY_LIMITS: Record<Plan, number | null> = {
  starter: 5,
  growth: 25,
  pro: 100,
  enterprise: null,
};

// Display labels for the plan-selection / upgrade UI. Prices are
// deliberately NOT here yet — pricing isn't decided, and there's no
// checkout, so tiers are shown by property capacity only for now.
export const PLAN_LABELS: Record<Plan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const TRIAL_DAYS = 14;
