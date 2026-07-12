import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_PROPERTY_LIMITS, type Plan, type SubscriptionStatus } from './constants';

export type OrgPlanRow = {
  plan: Plan;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
};

/**
 * Fetch an org's plan/status/trial state. Returns null if the org row is
 * missing (shouldn't happen post-backfill/trigger — callers should fail
 * closed to the Starter limit, not treat missing as unlimited).
 *
 * `organizations` isn't in the hand-written DB type stubs, so the row is
 * cast through unknown (same pattern as route-auth.ts / migration 017).
 * Pass in the caller's existing service-role client rather than creating one.
 */
export async function getOrgPlan(
  db: SupabaseClient,
  organizationId: string
): Promise<OrgPlanRow | null> {
  const { data } = await db
    .from('organizations')
    .select('plan, subscription_status, trial_ends_at')
    .eq('id', organizationId)
    .maybeSingle();

  return (data as unknown as OrgPlanRow | null) ?? null;
}

/** True if adding one more property would exceed the plan's cap. */
export function isAtPropertyLimit(plan: Plan, currentCount: number): boolean {
  const limit = PLAN_PROPERTY_LIMITS[plan];
  return limit !== null && currentCount >= limit;
}

/** True if the org is still on a trial that has already ended. */
export function isTrialExpired(row: OrgPlanRow): boolean {
  return (
    row.subscription_status === 'trialing' &&
    new Date(row.trial_ends_at).getTime() < Date.now()
  );
}
