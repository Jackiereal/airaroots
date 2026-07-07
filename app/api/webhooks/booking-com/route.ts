import { NextResponse } from 'next/server';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';

// Booking.com push notifications.
// Log + trigger sync for the relevant property when we have enough info.
export async function POST(request: Request) {
  let payload: unknown = null;

  try {
    const text = await request.text();
    try { payload = JSON.parse(text); } catch { payload = text; }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => { headers[key] = value; });

    const db = createServiceRoleClientLoose();
    await db.from('channel_webhook_logs').insert({
      channel: 'booking_com',
      headers,
      payload: typeof payload === 'object' ? payload as Record<string, unknown> : { raw: payload },
      signature_valid: null,
      processed: false,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook/booking-com]', err);
    return NextResponse.json({ received: true });
  }
}
