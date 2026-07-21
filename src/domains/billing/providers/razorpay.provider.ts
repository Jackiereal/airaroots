import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';

// Thin wrapper over the Razorpay SDK. Holds NO business logic and never touches
// the DB — the SubscriptionService owns state, the API routes own persistence.

let client: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (client) return client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured');
  }
  client = new Razorpay({ key_id, key_secret });
  return client;
}

export type CreateSubscriptionArgs = {
  razorpayPlanId: string;
  totalCount: number;
  organizationId: string;
};

export type CreateSubscriptionResult = {
  subscriptionId: string;
  shortUrl: string | null;
  status: string;
};

export async function createSubscription(
  args: CreateSubscriptionArgs
): Promise<CreateSubscriptionResult> {
  const sub = await getRazorpayClient().subscriptions.create({
    plan_id: args.razorpayPlanId,
    total_count: args.totalCount,
    quantity: 1,
    customer_notify: 1,
    // Echoed back on every webhook for this subscription — lets the webhook
    // resolve the org without a DB lookup.
    notes: { organization_id: args.organizationId },
  });

  return {
    subscriptionId: sub.id,
    shortUrl: (sub as { short_url?: string }).short_url ?? null,
    status: sub.status,
  };
}

export type FetchedSubscription = {
  status: string;
  currentPeriodEnd: string | null; // ISO, from current_end (unix seconds)
};

// Used by the reconciliation cron to poll the real state of a subscription
// directly, in case a webhook was missed and our DB is stale.
export async function fetchSubscription(razorpaySubscriptionId: string): Promise<FetchedSubscription> {
  const sub = await getRazorpayClient().subscriptions.fetch(razorpaySubscriptionId);
  const currentEnd = (sub as { current_end?: number | null }).current_end;
  return {
    status: sub.status,
    currentPeriodEnd: currentEnd ? new Date(currentEnd * 1000).toISOString() : null,
  };
}

// HMAC-SHA256 of the RAW request body with the webhook secret, timing-safe
// compared to the x-razorpay-signature header. Returns a boolean; never throws
// (a missing secret or malformed signature is just "not verified").
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
