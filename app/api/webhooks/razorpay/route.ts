import { NextResponse } from 'next/server';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { verifyWebhookSignature } from '@/src/domains/billing/providers/razorpay.provider';
import { SubscriptionService } from '@/src/domains/billing/services/subscription.service';
import type { RazorpayWebhookEvent } from '@/src/domains/billing/types';

// Node crypto for HMAC verification — not edge-safe.
export const runtime = 'nodejs';

// POST /api/webhooks/razorpay — Razorpay subscription webhooks.
//
// The signature IS the auth (no requireOrgAuth — Razorpay calls this). We read
// the RAW body (request.text(), NOT request.json() which would re-serialize and
// break the HMAC), verify it, then dispatch to the idempotent SubscriptionService.
//
// Return 200 on success OR dedup so Razorpay stops retrying. Only an unexpected
// processing error returns non-2xx (Razorpay retries; the event ledger guards
// against double-apply).
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  const eventId = request.headers.get('x-razorpay-event-id');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  if (!eventId) {
    // No dedup key — refuse rather than risk double-processing on retry.
    return NextResponse.json({ error: 'missing event id' }, { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    const db = createServiceRoleClientLoose();
    const service = new SubscriptionService(db);
    await service.handleWebhookEvent({ eventId, event });
    return NextResponse.json({ received: true });
  } catch (err) {
    // Unexpected error — let Razorpay retry (the ledger keeps it idempotent).
    console.error('[webhook/razorpay]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
