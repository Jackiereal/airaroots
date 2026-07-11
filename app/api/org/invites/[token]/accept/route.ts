import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ token: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { token } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // accept_org_invite is SECURITY DEFINER (see migration 017) — it validates
  // the token itself (unused, unexpired) and moves the calling user
  // (auth.uid(), resolved inside the function) into the invite's org.
  // Cast: not yet in the generated DB types until 017 is applied + types
  // regenerated (`supabase gen types`) — remove the cast once that's done.
  const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)(
    'accept_org_invite',
    { p_token: token }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ result: data });
}
