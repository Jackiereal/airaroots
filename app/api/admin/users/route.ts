import { requireOrgRole, ORG_ROLE_RANK, type OrgRole } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const VALID_ROLES = Object.keys(ORG_ROLE_RANK) as OrgRole[];

export async function GET() {
  const { error: authError, ctx } = await requireOrgRole('manager');
  if (authError) return authError;

  const db = createServiceRoleClientLoose();
  const { data: members, error } = await db
    .from('organization_members')
    .select('user_id, role, created_at')
    .eq('organization_id', ctx!.organizationId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await db
    .from('user_profiles')
    .select('id, full_name')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const users = (members ?? []).map((m) => ({
    id: m.user_id,
    full_name: profileById.get(m.user_id)?.full_name ?? null,
    role: m.role,
  }));

  return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
  const { error: authError, ctx } = await requireOrgRole('manager');
  if (authError) return authError;

  const { userId, role } = (await req.json()) as { userId?: string; role?: string };
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  if (!role || !VALID_ROLES.includes(role as OrgRole)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
  }
  // Privilege cap: can't promote someone above your own rank.
  if (ORG_ROLE_RANK[role as OrgRole] > ORG_ROLE_RANK[ctx!.role]) {
    return NextResponse.json({ error: `Cannot set a role higher than your own (${ctx!.role})` }, { status: 403 });
  }

  const db = createServiceRoleClientLoose();
  const { error } = await db
    .from('organization_members')
    .update({ role })
    .eq('organization_id', ctx!.organizationId)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
