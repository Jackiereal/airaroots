// Billing plan definitions (Phase 8 minimal scope).
//
// These MUST stay in sync with the SQL CHECK constraints on the
// organizations table (migration 026) — plan and subscription_status
// values are duplicated there. Two tracks: Individual (Owner) and
// PMC (Growth/Pro/Enterprise) — see docs/01 Vision/01 Executive Summary.md.

export type Plan = 'owner' | 'growth' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

// Max properties per plan. null = unlimited.
export const PLAN_PROPERTY_LIMITS: Record<Plan, number | null> = {
  owner: 3,
  growth: 10,
  pro: 25,
  enterprise: null,
};

// Display labels for the plan-selection / upgrade UI.
export const PLAN_LABELS: Record<Plan, string> = {
  owner: 'Owner',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const TRIAL_DAYS = 14;
