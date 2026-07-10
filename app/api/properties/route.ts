import { requireOrgRole, requireOrgWrite } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const { error: authError, ctx } = await requireOrgRole('viewer');
  if (authError) return authError;

  const db = createServiceRoleClientLoose();
  const { data, error } = await db
    .from('properties')
    .select('*')
    .eq('organization_id', ctx!.organizationId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ properties: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { error: authError, ctx } = await requireOrgWrite();
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

  const db = createServiceRoleClientLoose();
  const { data, error } = await db
    .from('properties')
    .insert({
      name: body.name.trim(),
      slug: body.slug.trim().toLowerCase(),
      address: body.address?.trim() || null,
      description: body.description?.trim() || null,
      platform: body.platform ?? 'airbnb',
      created_by: ctx!.userId,
      organization_id: ctx!.organizationId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ property: data }, { status: 201 });
}
