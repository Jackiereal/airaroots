import { requireAdmin } from '@/lib/auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;
  const db = createServiceRoleClientLoose();
  const { data, error } = await db.from('property_access').select('property_id, user_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ access: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { error: authError, profile } = await requireAdmin();
  if (authError) return authError;

  const { userId, propertyId } = (await req.json()) as { userId?: string; propertyId?: string };
  if (!userId || !propertyId) return NextResponse.json({ error: 'userId and propertyId required' }, { status: 400 });

  const db = createServiceRoleClientLoose();
  const { data, error } = await db
    .from('property_access')
    .insert({ property_id: propertyId, user_id: userId, granted_by: profile!.id })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Access already granted' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ access: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { userId, propertyId } = (await req.json()) as { userId?: string; propertyId?: string };
  if (!userId || !propertyId) return NextResponse.json({ error: 'userId and propertyId required' }, { status: 400 });

  const db = createServiceRoleClientLoose();
  const { error } = await db
    .from('property_access')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
