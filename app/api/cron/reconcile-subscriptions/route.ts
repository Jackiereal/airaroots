import { NextResponse } from 'next/server';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { SubscriptionService } from '@/src/domains/billing/services/subscription.service';
import { fetchSubscription } from '@/src/domains/billing/providers/razorpay.provider';

// Uses Node crypto (via the provider) — not edge-safe.
export const runtime = 'nodejs';

// Reconciliation: polls Razorpay directly for every subscription still in a
// non-terminal DB state, and re-applies syncOrgFromStatus if Razorpay's real
// status has moved on without us. Exists because webhooks can be lost — a
// customer pays, we never hear about it, and stays capped indefinitely with no
// self-healing. This is the highest-value safety net on the billing system
// (see project_razorpay_billing memory: "build this first post-launch").
//
// Not wired to a scheduler in-repo — same as cron/sync-channels, point an
// external scheduler (Railway Cron Job / Vercel Cron) at this route with
// CRON_SECRET, e.g. every 15-30 minutes.
export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceRoleClientLoose();
  const service = new SubscriptionService(db);

  const results: { razorpaySubscriptionId: string; dbStatus: string; liveStatus?: string; changed: boolean; error?: string }[] = [];

  try {
    const candidates = await service.listReconcilableSubscriptions();

    for (const sub of candidates) {
      try {
        const live = await fetchSubscription(sub.razorpaySubscriptionId);
        const changed = live.status !== sub.dbStatus;

        if (changed) {
          await service.syncOrgFromStatus(
            sub.organizationId,
            sub.razorpaySubscriptionId,
            live.status,
            live.currentPeriodEnd ?? undefined
          );
        }

        results.push({
          razorpaySubscriptionId: sub.razorpaySubscriptionId,
          dbStatus: sub.dbStatus,
          liveStatus: live.status,
          changed,
        });
      } catch (err) {
        // One bad subscription (e.g. deleted on Razorpay's side) shouldn't
        // abort reconciliation for the rest.
        results.push({
          razorpaySubscriptionId: sub.razorpaySubscriptionId,
          dbStatus: sub.dbStatus,
          changed: false,
          error: err instanceof Error ? err.message : 'fetch failed',
        });
      }
    }

    const summary = {
      checked: results.length,
      changed: results.filter((r) => r.changed).length,
      errored: results.filter((r) => r.error).length,
    };

    return NextResponse.json({ ok: true, summary, results });
  } catch (err) {
    console.error('[cron/reconcile-subscriptions]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Reconciliation failed' },
      { status: 500 }
    );
  }
}
