import { createServerClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : requestUrl.origin);

  if (error) {
    const msg = errorDescription || error || 'Authentication failed';
    return NextResponse.redirect(
      new URL(`/auth/signin?error=${encodeURIComponent(msg)}`, origin)
    );
  }

  if (code) {
    const cookieStore = await cookies();
    const newCookies: { name: string; value: string; options: CookieOptions }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) { newCookies.push(...cookiesToSet); },
        },
      }
    );

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && data.user) {
      const fullName =
        data.user.user_metadata?.full_name ??
        data.user.user_metadata?.name ??
        data.user.email?.split('@')[0] ??
        'User';

      try {
        const serviceClient = createServiceRoleClient();
        const { data: existing } = await serviceClient
          .from('user_profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        let isNewUser = false;
        if (!existing) {
          await serviceClient.from('user_profiles').insert({
            id: data.user.id,
            full_name: String(fullName),
            role: 'admin',
          });
          isNewUser = true;
        }
        // New users go to onboarding; returning users respect the `next` param
        if (isNewUser) {
          const response = NextResponse.redirect(new URL('/onboarding', origin));
          newCookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          return response;
        }
      } catch {
        // Trigger may have already created profile — non-fatal
      }

      const response = NextResponse.redirect(new URL(next, origin));
      newCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
    }

    return NextResponse.redirect(
      new URL(`/auth/signin?error=${encodeURIComponent(exchangeError?.message || 'Could not authenticate')}`, origin)
    );
  }

  return NextResponse.redirect(new URL('/auth/signin?error=Could+not+authenticate', origin));
}
