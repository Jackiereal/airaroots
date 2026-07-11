import { createClient, createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ token: string }> };

// Public-ish preview: anyone authenticated can look up an invite by token
// to see what org/role they'd be joining before accepting. RLS's
// org_invites_select_by_token policy is what actually gates this (token
// possession, not org membership) — this route just needs *a* session.
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceRoleClientLoose();
  const { data: invite, error } = await db
    .from('org_invites')
    .select('token, organization_id, role, expires_at, used_at, created_by')
    .eq('token', token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
  }

  const { data: inviter } = await db
    .from('user_profiles')
    .select('full_name')
    .eq('id', invite.created_by)
    .maybeSingle();

  return NextResponse.json({
    invite: {
      role: invite.role,
      invitedBy: inviter?.full_name ?? 'A team member',
    },
  });
}
