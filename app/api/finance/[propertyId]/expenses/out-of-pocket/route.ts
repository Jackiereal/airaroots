import { requireAdmin } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const ownerId = url.searchParams.get('owner_id');

  const db = createServiceRoleClient();
  let query = db
    .from('property_finance_expenses')
    .select('*')
    .eq('property_id', propertyId)
    .eq('paid_from', 'out_of_pocket')
    .order('created_at', { ascending: false });

  if (ownerId) query = query.eq('owner_id', ownerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data ?? [] });
}
