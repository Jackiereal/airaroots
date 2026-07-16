import { requireOrgRole } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { SubscriptionService } from '@/src/domains/billing/services/subscription.service';
import { createSubscription } from '@/src/domains/billing/providers/razorpay.provider';
import { SubscribeSchema } from '@/src/domains/billing/schema';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';
import { NotFoundError, ConflictError } from '@/src/shared/errors/domain-errors';

// Uses Node crypto (via the provider) + the razorpay SDK — not edge-safe.
export const runtime = 'nodejs';

// POST — start a Razorpay recurring subscription for the caller's org. Owner
// only (committing to a payment mandate is an owner-level financial action).
// The client sends ONLY the plan slug; the razorpay_plan_id + amount are
// resolved server-side from subscription_plans, never trusted from input.
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { error: authError, ctx } = await requireOrgRole('owner');
    if (authError) return authError;

    const { plan } = SubscribeSchema.parse(await req.json());

    const db = createServiceRoleClientLoose();
    const service = new SubscriptionService(db);

    const planRow = await service.findActivePlan(plan);
    if (!planRow) throw new NotFoundError('subscription plan', plan);

    if (await service.hasLiveSubscription(ctx!.organizationId)) {
      throw new ConflictError('This organization already has an active subscription', []);
    }

    const created = await createSubscription({
      razorpayPlanId: planRow.razorpayPlanId,
      totalCount: planRow.totalCount,
      organizationId: ctx!.organizationId,
    });

    await service.persistCreatedSubscription({
      organizationId: ctx!.organizationId,
      plan,
      razorpaySubscriptionId: created.subscriptionId,
      razorpayPlanId: planRow.razorpayPlanId,
      shortUrl: created.shortUrl,
      status: created.status,
    });

    return NextResponse.json({
      subscriptionId: created.subscriptionId,
      shortUrl: created.shortUrl,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null,
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/billing/subscribe');
  }
}
