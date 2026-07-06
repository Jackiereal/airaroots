import { requirePropertyAccess } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requirePropertyAccess(propertyId);
  if (authError) return authError;

  const today = new Date().toISOString().slice(0, 10);
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('property_finance_direct_bookings')
    .select('*')
    .eq('property_id', propertyId)
    .gte('check_in', today)
    .order('check_in', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ upcoming: data ?? [] });
}
