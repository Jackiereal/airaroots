'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, Loader2, Link2 } from 'lucide-react';

type Step = 'property' | 'channel' | 'done';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) + '-' + Date.now().toString(36);
}

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('property');
  const [propertyId, setPropertyId] = useState('');

  // Step 1 fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Step 2 fields
  const [icalUrl, setIcalUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  async function createProperty() {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: toSlug(name.trim()),
          address: address.trim() || null,
        }),
      });
      const data = await res.json() as { property?: { id: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to create property');
      setPropertyId(data.property!.id);
      setStep('channel');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  async function connectChannel() {
    if (!icalUrl.trim() || !propertyId) { setStep('done'); return; }
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch(`/api/properties/${propertyId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'airbnb', icalUrl: icalUrl.trim() }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to connect Airbnb');
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Connection failed');
      return;
    } finally {
      setConnecting(false);
    }
    setStep('done');
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          A
        </div>
        <span
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-rajdhani), sans-serif', color: 'var(--accent)' }}
        >
          Airaroots
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-10">
        {(['property', 'channel', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                background: step === s
                  ? 'var(--accent)'
                  : (['property', 'channel', 'done'].indexOf(step) > i)
                    ? 'var(--accent)'
                    : 'var(--border-color)',
              }}
            />
            {i < 2 && <div className="w-6 h-px" style={{ background: 'var(--border-color)' }} />}
          </div>
        ))}
      </div>

      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
      >
        {/* Step 1: Property */}
        {step === 'property' && (
          <>
            <h1
              className="text-2xl font-bold mb-1"
              style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}
            >
              Add your first property
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Takes 30 seconds. You can add more later.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Property name <span style={{ color: 'var(--color-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createProperty()}
                  placeholder="e.g. Sea Breeze Villa, Anjuna"
                  autoFocus
                  className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none"
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Location <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createProperty()}
                  placeholder="e.g. Anjuna, Goa"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none"
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
                />
              </div>
            </div>

            {createError && (
              <p className="text-sm mb-4" style={{ color: 'var(--color-red)' }}>{createError}</p>
            )}

            <button
              onClick={createProperty}
              disabled={!name.trim() || creating}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              {creating ? 'Creating…' : 'Continue'}
            </button>
          </>
        )}

        {/* Step 2: Channel */}
        {step === 'channel' && (
          <>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-muted)' }}>
              <Link2 size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <h1
              className="text-2xl font-bold mb-1"
              style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}
            >
              Connect Airbnb
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Paste your Airbnb iCal URL to sync bookings automatically every 15 minutes.
            </p>

            <details className="mb-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <summary className="cursor-pointer hover:underline underline-offset-2">
                How to get your Airbnb iCal URL →
              </summary>
              <ol className="mt-2 space-y-1 ml-3 list-decimal">
                <li>Go to Airbnb → Calendar → Availability settings</li>
                <li>Scroll down to "Sync calendars"</li>
                <li>Click "Export calendar" → copy the URL</li>
              </ol>
            </details>

            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Airbnb iCal URL
              </label>
              <input
                type="url"
                value={icalUrl}
                onChange={e => setIcalUrl(e.target.value)}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                autoFocus
                className="w-full rounded-lg border px-3 py-2.5 text-sm font-mono transition-colors focus:outline-none"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>

            {connectError && (
              <p className="text-sm mb-4" style={{ color: 'var(--color-red)' }}>{connectError}</p>
            )}

            <button
              onClick={connectChannel}
              disabled={!icalUrl.trim() || connecting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 mb-3"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {connecting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              {connecting ? 'Connecting…' : 'Connect Airbnb'}
            </button>

            <button
              onClick={() => setStep('done')}
              disabled={connecting}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}
            >
              Skip for now
            </button>
          </>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'var(--accent-muted)' }}
            >
              <CheckCircle2 size={28} style={{ color: 'var(--accent)' }} />
            </div>
            <h1
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}
            >
              You&apos;re all set!
            </h1>
            <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
              Your dashboard is ready. You can add more properties, connect other channels, and set up housekeeping from there.
            </p>

            <div className="space-y-2 text-left mb-8">
              {[
                'Calendar with all your bookings',
                'Finance & P&L tracking',
                'Housekeeping management',
                'Maintenance requests',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              Go to Dashboard
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {step !== 'done' && (
        <p className="mt-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          You can always change these settings later.
        </p>
      )}
    </div>
  );
}
