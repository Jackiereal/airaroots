import { requireOrgRole, requireOrgWrite } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { getOrgPlan, isAtPropertyLimit, isTrialExpired } from '@/src/domains/billing/org-plan';
import { PLAN_PROPERTY_LIMITS } from '@/src/domains/billing/constants';
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

  // Plan-limit enforcement. Fail closed to Solo if the org row is
  // somehow missing (shouldn't happen post-020 backfill / 021 trigger).
  const orgPlan = (await getOrgPlan(db, ctx!.organizationId)) ?? {
    plan: 'solo' as const,
    subscription_status: 'trialing' as const,
    trial_ends_at: new Date(0).toISOString(),
  };

  if (isTrialExpired(orgPlan)) {
    return NextResponse.json(
      { error: 'trial_expired', message: 'Your free trial has ended — choose a plan to add properties.' },
      { status: 403 }
    );
  }

  const { count: propertyCount } = await db
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx!.organizationId);

  if (isAtPropertyLimit(orgPlan.plan, propertyCount ?? 0)) {
    return NextResponse.json(
      {
        error: 'plan_limit_reached',
        message: `You've reached your ${orgPlan.plan} plan limit of ${PLAN_PROPERTY_LIMITS[orgPlan.plan]} properties. Upgrade to add more.`,
        plan: orgPlan.plan,
        limit: PLAN_PROPERTY_LIMITS[orgPlan.plan],
      },
      { status: 403 }
    );
  }

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

  // Visibility is gated entirely by property_access (see migration 015) —
  // without this grant the creator can't see their own new property.
  const { error: accessError } = await db.from('property_access').insert({
    property_id: data.id,
    user_id: ctx!.userId,
    granted_by: ctx!.userId,
    role: 'admin',
  });
  if (accessError) {
    await db.from('properties').delete().eq('id', data.id);
    return NextResponse.json({ error: accessError.message }, { status: 500 });
  }

  return NextResponse.json({ property: data }, { status: 201 });
}
