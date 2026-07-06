import { requireAdmin } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('property_owners')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ owners: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const body = (await req.json()) as { name?: string; user_id?: string | null };
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('property_owners')
    .insert({ property_id: propertyId, name: body.name.trim(), user_id: body.user_id ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ owner: data }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const ownerId = url.searchParams.get('id');
  if (!ownerId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = createServiceRoleClient();
  const { error } = await db
    .from('property_owners')
    .delete()
    .eq('id', ownerId)
    .eq('property_id', propertyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
