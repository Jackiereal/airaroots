'use client';

import { Suspense, useState, useEffect } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation';

function SignInContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const redirectPath = searchParams.get('redirect') || '/dashboard';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace(redirectPath);
      } else {
        setCheckingSession(false);
      }
    });
  }, [supabase, router, redirectPath]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) setError(decodeURIComponent(errorParam));
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const callbackUrl = new URL('/auth/callback', baseUrl);
      callbackUrl.searchParams.set('next', redirectPath);

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: { prompt: 'select_account' },
        },
      });

      if (signInError) setError(signInError.message || 'Failed to sign in with Google');
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border-color)] border-t-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <div className="mb-8 flex flex-col items-center gap-2">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          A
        </div>
        <span
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-fraunces), sans-serif' }}
        >
          Hostezy
        </span>
      </div>

      <div
        className="w-full max-w-sm space-y-6 p-8 rounded-2xl"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div className="text-center">
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-fraunces), sans-serif' }}
          >
            Welcome back
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Sign in to manage your properties
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--color-red-muted)', color: 'var(--color-red)', border: '1px solid var(--color-red)' }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border-color)] border-t-[var(--accent)]" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
