import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { getOrgPlan } from '@/src/domains/billing/org-plan';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export const runtime = 'nodejs';

// GET — the org's current plan/status + latest subscription row. Used by the UI
// to poll after checkout ("Activating your subscription…") until the webhook has
// flipped subscription_status to active.
export async function GET() {
  try {
    const { error: authError, ctx } = await requireOrgAuth();
    if (authError) return authError;

    const db = createServiceRoleClientLoose();
    const org = await getOrgPlan(db, ctx!.organizationId);

    const { data: sub } = await db
      .from('subscriptions')
      .select('plan, status, short_url, current_period_end, created_at')
      .eq('organization_id', ctx!.organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      plan: org?.plan ?? null,
      subscriptionStatus: org?.subscription_status ?? null,
      subscription: sub ?? null,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/billing/subscription');
  }
}
