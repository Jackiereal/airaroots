import { requireOrgRole } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { SubscriptionService } from '@/src/domains/billing/services/subscription.service';
import { cancelSubscription } from '@/src/domains/billing/providers/razorpay.provider';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError } from '@/src/shared/errors/domain-errors';

// Uses Node crypto (via the provider) — not edge-safe.
export const runtime = 'nodejs';

// POST — cancel the caller's org's active subscription. Owner only, same as
// subscribe. Tells Razorpay to stop billing; the actual organizations.plan /
// subscription_status flip happens via the subscription.cancelled webhook
// (or the reconciliation cron, if the webhook is missed) — this route doesn't
// write org state directly, keeping SubscriptionService the single writer.
export async function POST() {
  try {
    const { error: authError, ctx } = await requireOrgRole('owner');
    if (authError) return authError;

    const db = createServiceRoleClientLoose();
    const service = new SubscriptionService(db);

    const current = await service.findCurrentSubscription(ctx!.organizationId);
    if (!current) throw new NotFoundError('active subscription', ctx!.organizationId);

    await cancelSubscription(current.razorpaySubscriptionId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, 'POST /api/billing/cancel');
  }
}
