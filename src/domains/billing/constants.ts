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

export const TRIAL_DAYS = 14;
