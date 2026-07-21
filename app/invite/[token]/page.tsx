'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
};

type Status = 'loading' | 'signed-out' | 'accepting' | 'accepted' | 'error';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{ role: string; invitedBy: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function run() {
      const { data: { user } } = await supabase.auth.getUser();

      const previewRes = await fetch(`/api/org/invites/${token}`);
      if (!previewRes.ok) {
        const body = await previewRes.json().catch(() => ({}));
        setError(body.error ?? 'Invite not found or expired');
        setStatus('error');
        return;
      }
      const { invite: previewInvite } = await previewRes.json();
      setInvite(previewInvite);

      if (!user) {
        setStatus('signed-out');
        return;
      }

      setStatus('accepting');
      const acceptRes = await fetch(`/api/org/invites/${token}/accept`, { method: 'POST' });
      if (!acceptRes.ok) {
        const body = await acceptRes.json().catch(() => ({}));
        setError(body.error ?? 'Could not accept invite');
        setStatus('error');
        return;
      }

      setStatus('accepted');
      setTimeout(() => router.replace('/dashboard'), 1500);
    }

    run().catch(() => {
      setError('Something went wrong');
      setStatus('error');
    });
  }, [token, router]);

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const callbackUrl = new URL('/auth/callback', baseUrl);
    callbackUrl.searchParams.set('next', `/invite/${token}`);

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { prompt: 'select_account' },
      },
    });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <div
        className="w-full max-w-sm space-y-6 p-8 rounded-2xl text-center"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div className="mb-2 flex flex-col items-center gap-2">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            A
          </div>
          <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>
            Hostezy
          </span>
        </div>

        {status === 'loading' && (
          <div className="animate-spin rounded-full h-8 w-8 border-2 mx-auto border-[var(--border-color)] border-t-[var(--accent)]" />
        )}

        {(status === 'signed-out' || status === 'accepting' || status === 'accepted') && invite && (
          <div className="space-y-1">
            <h2 className="text-lg font-bold">You're invited</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {invite.invitedBy} invited you to join as <span className="font-medium">{ROLE_LABELS[invite.role] ?? invite.role}</span>.
            </p>
          </div>
        )}

        {status === 'signed-out' && (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          >
            Continue with Google
          </button>
        )}

        {status === 'accepting' && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Joining…</p>
        )}

        {status === 'accepted' && (
          <p className="text-sm text-[var(--color-green)]">Welcome aboard! Redirecting…</p>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>
            <a href="/auth/signin" className="text-xs underline" style={{ color: 'var(--text-secondary)' }}>
              Go to sign in
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
