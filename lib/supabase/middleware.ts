import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/auth') ||
    // Inbound webhooks (Razorpay, Airbnb, Booking.com) have no user session —
    // they authenticate via signature/secret in the route itself. Redirecting
    // them to /auth/signin makes them permanently unreachable.
    request.nextUrl.pathname.startsWith('/api/webhooks') ||
    // Cron routes (channel sync, subscription reconciliation) are called by an
    // external scheduler with no user session — same class of bug as webhooks,
    // authenticate via CRON_SECRET header in the route itself.
    request.nextUrl.pathname.startsWith('/api/cron') ||
    // Public plan catalog for the marketing pricing section — an anonymous
    // visitor on '/' has no session, so this must be reachable pre-auth too.
    request.nextUrl.pathname === '/api/billing/plans';

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/signin';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
