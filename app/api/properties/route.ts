import { requireAdmin, requireAuth } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const { error: authError, user } = await requireAuth();
  if (authError) return authError;

  const db = createServiceRoleClient();

  // Get user role
  const { data: profile } = await db.from('user_profiles').select('role').eq('id', user!.id).maybeSingle();

  let properties;
  if (profile?.role === 'admin') {
    const { data, error } = await db.from('properties').select('*').order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    properties = data;
  } else {
    // Client: only properties they have access to
    const { data: accessRows, error: accessErr } = await db
      .from('property_access')
      .select('property_id')
      .eq('user_id', user!.id);
    if (accessErr) return NextResponse.json({ error: accessErr.message }, { status: 500 });
    const ids = (accessRows ?? []).map(r => r.property_id);
    if (ids.length === 0) return NextResponse.json({ properties: [] });
    const { data, error } = await db.from('properties').select('*').in('id', ids).order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    properties = data;
  }

  return NextResponse.json({ properties: properties ?? [] });
}

export async function POST(req: NextRequest) {
  const { error: authError, profile } = await requireAdmin();
  if (authError) return authError;

  const body = (await req.json()) as {
    name?: string;
    slug?: string;
    address?: string | null;
    description?: string | null;
    platform?: string;
  };

  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!body.slug?.trim()) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('properties')
    .insert({
      name: body.name.trim(),
      slug: body.slug.trim().toLowerCase(),
      address: body.address?.trim() || null,
      description: body.description?.trim() || null,
      platform: body.platform ?? 'airbnb',
      created_by: profile!.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ property: data }, { status: 201 });
}
