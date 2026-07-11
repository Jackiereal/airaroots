import { requireOrgRole, ORG_ROLE_RANK, type OrgRole } from '@/src/shared/utils/route-auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const VALID_ROLES = Object.keys(ORG_ROLE_RANK) as OrgRole[];

export async function GET() {
  const { error: authError, ctx } = await requireOrgRole('manager');
  if (authError) return authError;

  const db = createServiceRoleClientLoose();
  const { data, error } = await db
    .from('org_invites')
    .select('id, token, role, created_by, expires_at, used_at, used_by, created_at')
    .eq('organization_id', ctx!.organizationId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { error: authError, ctx } = await requireOrgRole('manager');
  if (authError) return authError;

  const { role } = (await req.json()) as { role?: string };
  if (!role || !VALID_ROLES.includes(role as OrgRole)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
  }

  // Privilege cap: can't invite someone in above your own rank.
  if (ORG_ROLE_RANK[role as OrgRole] > ORG_ROLE_RANK[ctx!.role]) {
    return NextResponse.json({ error: `Cannot invite as a role higher than your own (${ctx!.role})` }, { status: 403 });
  }

  const db = createServiceRoleClientLoose();
  const { data, error } = await db
    .from('org_invites')
    .insert({
      organization_id: ctx!.organizationId,
      role,
      created_by: ctx!.userId,
    })
    .select('id, token, role, expires_at, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invite: data }, { status: 201 });
}
