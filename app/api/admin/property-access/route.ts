import { requireOrgWrite } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<boolean> {
  const db = createServiceRoleClientLoose();
  const { data } = await db.from('properties').select('organization_id').eq('id', propertyId).maybeSingle();
  return !!data && data.organization_id === organizationId;
}

export async function GET(req: NextRequest) {
  const { error: authError, ctx } = await requireOrgWrite();
  if (authError) return authError;

  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId');

  const db = createServiceRoleClientLoose();
  let query = db.from('property_access').select('property_id, user_id, role');
  if (propertyId) {
    if (!(await assertPropertyInOrg(propertyId, ctx!.organizationId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    query = query.eq('property_id', propertyId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ access: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { error: authError, ctx } = await requireOrgWrite();
  if (authError) return authError;

  const { userId, propertyId, role } = (await req.json()) as {
    userId?: string;
    propertyId?: string;
    role?: 'admin' | 'client';
  };
  if (!userId || !propertyId) return NextResponse.json({ error: 'userId and propertyId required' }, { status: 400 });
  if (role && role !== 'admin' && role !== 'client') {
    return NextResponse.json({ error: "role must be 'admin' or 'client'" }, { status: 400 });
  }
  if (!(await assertPropertyInOrg(propertyId, ctx!.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = createServiceRoleClientLoose();
  const { data, error } = await db
    .from('property_access')
    .insert({ property_id: propertyId, user_id: userId, granted_by: ctx!.userId, role: role ?? 'client' })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Access already granted' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ access: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { error: authError, ctx } = await requireOrgWrite();
  if (authError) return authError;

  const { userId, propertyId } = (await req.json()) as { userId?: string; propertyId?: string };
  if (!userId || !propertyId) return NextResponse.json({ error: 'userId and propertyId required' }, { status: 400 });
  if (!(await assertPropertyInOrg(propertyId, ctx!.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = createServiceRoleClientLoose();
  const { error } = await db
    .from('property_access')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
