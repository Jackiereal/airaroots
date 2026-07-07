import { NextResponse } from 'next/server';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';

// Airbnb push notifications (if/when Airbnb enables webhook access for the account).
// For now: log the payload, mark processed=false for manual review.
// Full webhook processing added when Airbnb partner API access is granted.
export async function POST(request: Request) {
  let payload: unknown = null;

  try {
    const text = await request.text();
    try { payload = JSON.parse(text); } catch { payload = text; }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => { headers[key] = value; });

    const db = createServiceRoleClientLoose();
    await db.from('channel_webhook_logs').insert({
      channel: 'airbnb',
      headers,
      payload: typeof payload === 'object' ? payload as Record<string, unknown> : { raw: payload },
      signature_valid: null, // TODO: verify X-Airbnb-Signature when partner access enabled
      processed: false,
    });

    // Acknowledge immediately — Airbnb requires 200 within 5s
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook/airbnb]', err);
    return NextResponse.json({ received: true }); // Always 200 to prevent retries
  }
}
