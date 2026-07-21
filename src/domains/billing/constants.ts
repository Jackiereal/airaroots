// Billing plan definitions (Phase 8 minimal scope).
//
// These MUST stay in sync with the SQL CHECK constraints on the
// organizations table (migration 025) — plan and subscription_status
// values are duplicated there. Two tracks: Individual (Solo/Small) and
// PMC (Growth/Pro/Enterprise) — see docs/01 Vision/01 Executive Summary.md.

export type Plan = 'solo' | 'small' | 'growth' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

// Max properties per plan. null = unlimited.
export const PLAN_PROPERTY_LIMITS: Record<Plan, number | null> = {
  solo: 1,
  small: 3,
  growth: 10,
  pro: 25,
  enterprise: null,
};

// Display labels for the plan-selection / upgrade UI.
export const PLAN_LABELS: Record<Plan, string> = {
  solo: 'Solo',
  small: 'Small',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const TRIAL_DAYS = 14;
