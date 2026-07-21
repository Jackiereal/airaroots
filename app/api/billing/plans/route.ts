import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/src/shared/utils/api-error-handler';

export const runtime = 'nodejs';

// GET — public plan catalog for the marketing pricing section. No auth: this is
// display-only pricing info, same data an anonymous visitor could see on any
// pricing page. subscription_plans RLS requires an org member, so this route
// uses the service-role client to read past that (safe — no write, no secrets
// beyond razorpay_plan_id, which isn't sensitive).
export async function GET() {
  try {
    const db = createServiceRoleClientLoose();
    const { data, error } = await db
      .from('subscription_plans')
      .select('plan, amount_paise, currency, billing_period')
      .eq('is_active', true);

    if (error) throw new Error(`DB error: ${error.message}`);

    return NextResponse.json({ plans: data ?? [] });
  } catch (error) {
    return handleApiError(error, 'GET /api/billing/plans');
  }
}
