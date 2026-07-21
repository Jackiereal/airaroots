'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import {
  Calendar,
  Sparkles,
  Wrench,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Link2,
  ClipboardCheck,
} from 'lucide-react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import PricingSection from '@/components/marketing/PricingSection';

export default function Home() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: access } = await supabase
          .from('property_access')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (access) {
          router.replace('/dashboard');
        } else {
          router.replace('/client/dashboard');
        }
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [router, supabase]);

  if (checkingAuth) {
    return (
      <div className="marketing-page min-h-screen flex items-center justify-center" style={{ background: 'var(--m-ground)' }}>
        <div className="h-9 w-9 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--m-border)', borderTopColor: 'var(--m-accent)' }} />
      </div>
    );
  }

  return (
    <div className="marketing-page font-[family-name:var(--font-manrope)]" style={{ background: 'var(--m-ground)', color: 'var(--m-ink)' }}>
      <MarketingTokens />
      <Nav />
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <Services />
      <OwnerPortal />
      <WhySection />
      <PricingSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// Scoped design tokens for the marketing page only — deliberately isolated
// from the dashboard's global --bg-*/--accent tokens (Spotify-green, used
// across 35+ files) via the .marketing-page class instead of :root, so the
// internal app's look is untouched.
function MarketingTokens() {
  return (
    <style>{`
      .marketing-page {
        --m-ground: #FAF4EA;
        --m-ground-raised: #F4EBDC;
        --m-ink: #2B241D;
        --m-ink-soft: #6B6053;
        --m-ink-faint: #9C9182;
        --m-border: #E3D8C4;
        --m-accent: #C4622D;
        --m-accent-deep: #8B3A1F;
        --m-accent-tint: #F0DECB;
        --m-brass: #9C7A3C;
        --m-sage: #5C6B4E;
        --m-sage-tint: #E4E8DC;
        --m-card: #FFFDF9;
      }
      @media (prefers-color-scheme: dark) {
        .marketing-page {
          --m-ground: #211B16;
          --m-ground-raised: #2A231C;
          --m-ink: #F2E9DC;
          --m-ink-soft: #B8AB98;
          --m-ink-faint: #7D7264;
          --m-border: #3A3128;
          --m-accent: #E08248;
          --m-accent-deep: #F2A876;
          --m-accent-tint: #3D2D1F;
          --m-brass: #C9A868;
          --m-sage: #8FA37B;
          --m-sage-tint: #2C3325;
          --m-card: #292019;
        }
      }
      .marketing-page[data-theme="dark"] {
        --m-ground: #211B16;
        --m-ground-raised: #2A231C;
        --m-ink: #F2E9DC;
        --m-ink-soft: #B8AB98;
        --m-ink-faint: #7D7264;
        --m-border: #3A3128;
        --m-accent: #E08248;
        --m-accent-deep: #F2A876;
        --m-accent-tint: #3D2D1F;
        --m-brass: #C9A868;
        --m-sage: #8FA37B;
        --m-sage-tint: #2C3325;
        --m-card: #292019;
      }
      .marketing-page[data-theme="light"] {
        --m-ground: #FAF4EA;
        --m-ground-raised: #F4EBDC;
        --m-ink: #2B241D;
        --m-ink-soft: #6B6053;
        --m-ink-faint: #9C9182;
        --m-border: #E3D8C4;
        --m-accent: #C4622D;
        --m-accent-deep: #8B3A1F;
        --m-accent-tint: #F0DECB;
        --m-brass: #9C7A3C;
        --m-sage: #5C6B4E;
        --m-sage-tint: #E4E8DC;
        --m-card: #FFFDF9;
      }
      .marketing-page h1, .marketing-page h2, .marketing-page h3 {
        font-family: var(--font-fraunces), serif;
        text-wrap: balance;
      }
      .marketing-page .m-eyebrow {
        font-family: var(--font-manrope), sans-serif;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--m-brass);
      }
      .marketing-page .m-tabular { font-variant-numeric: tabular-nums; }
    `}</style>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur" style={{ background: 'color-mix(in srgb, var(--m-ground) 88%, transparent)', borderBottom: '1px solid var(--m-border)' }}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-base font-semibold" style={{ background: 'var(--m-accent)', color: '#FFFDF9', fontFamily: 'var(--font-fraunces), serif' }}>
            A
          </div>
          <span className="text-lg font-medium" style={{ fontFamily: 'var(--font-fraunces), serif', color: 'var(--m-ink)' }}>
            Hostezy
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <a href="#pricing" className="hidden sm:block text-sm font-medium" style={{ color: 'var(--m-ink-soft)' }}>
            Pricing
          </a>
          <Link
            href="/auth/signin"
            className="px-5 py-2.5 rounded-full text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95"
            style={{ background: 'var(--m-accent)', color: '#FFFDF9' }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  const [path, setPath] = useState<'owner' | 'pmc'>('owner');
  const copy = {
    owner: {
      tag: 'I own my property',
      desc: 'Stop juggling Airbnb messages, a cleaner\'s WhatsApp number, and a notes app for expenses. One dashboard tells you what\'s booked, what needs cleaning, and what you made.',
    },
    pmc: {
      tag: 'I manage properties for others',
      desc: 'Run your whole portfolio — staff, vendors, multiple owners — from one dashboard.',
    },
  };

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 900px 500px at 15% -10%, var(--m-accent-tint) 0%, transparent 60%), radial-gradient(ellipse 700px 500px at 100% 20%, var(--m-sage-tint) 0%, transparent 55%)',
        }}
      />
      <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
        <div>
          <p className="m-eyebrow mb-5">Property management software</p>
          <h1 className="text-5xl sm:text-6xl font-medium leading-[1.05] mb-6" style={{ color: 'var(--m-ink)' }}>
            Run your stays.
            <br />
            Skip the
            <br />
            <span style={{ fontStyle: 'italic', color: 'var(--m-accent)' }}>chaos.</span>
          </h1>
          <p className="text-lg mb-8 max-w-md" style={{ color: 'var(--m-ink-soft)' }}>
            One place for bookings, guests, cleaning, and money — whether you own one home
            or manage fifty for other people.
          </p>

          <div className="inline-flex p-1 rounded-full mb-5" style={{ background: 'var(--m-ground-raised)', border: '1px solid var(--m-border)' }}>
            {(['owner', 'pmc'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPath(p)}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                style={{
                  background: path === p ? 'var(--m-accent)' : 'transparent',
                  color: path === p ? '#FFFDF9' : 'var(--m-ink-soft)',
                }}
              >
                {copy[p].tag}
              </button>
            ))}
          </div>
          <p className="text-sm mb-8 max-w-md" style={{ color: 'var(--m-ink-soft)' }}>
            {copy[path].desc}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-base font-semibold transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: 'var(--m-accent)', color: '#FFFDF9' }}
            >
              Get started
              <ArrowRight size={18} />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-base font-semibold border transition-colors"
              style={{ borderColor: 'var(--m-border)', color: 'var(--m-ink)' }}
            >
              See pricing
            </a>
          </div>
          <p className="text-sm mt-5" style={{ color: 'var(--m-ink-faint)' }}>
            14-day free trial. No card required.
          </p>
        </div>

        <div className="rounded-3xl p-6 sm:p-8" style={{ background: 'var(--m-card)', border: '1px solid var(--m-border)', boxShadow: '0 24px 60px -30px rgba(43, 36, 29, 0.35)' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="m-eyebrow mb-1">This month</p>
              <p className="text-sm" style={{ color: 'var(--m-ink-soft)' }}>4 properties · Goa & Alibaug</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--m-sage-tint)', color: 'var(--m-sage)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--m-sage)' }} />
              92% occupied
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl p-4" style={{ background: 'var(--m-ground-raised)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--m-ink-faint)' }}>Net revenue</p>
              <p className="text-2xl font-medium m-tabular" style={{ fontFamily: 'var(--font-fraunces), serif', color: 'var(--m-ink)' }}>₹4,58,240</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--m-ground-raised)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--m-ink-faint)' }}>Upcoming stays</p>
              <p className="text-2xl font-medium m-tabular" style={{ fontFamily: 'var(--font-fraunces), serif', color: 'var(--m-ink)' }}>18</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={[
              { day: 'Mon', revenue: 24000 },
              { day: 'Tue', revenue: 31000 },
              { day: 'Wed', revenue: 19000 },
              { day: 'Thu', revenue: 42000 },
              { day: 'Fri', revenue: 51000 },
              { day: 'Sat', revenue: 68000 },
              { day: 'Sun', revenue: 58000 },
            ]}>
              <defs>
                <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--m-accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--m-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: 'var(--m-ink-faint)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--m-card)', border: '1px solid var(--m-border)', borderRadius: '10px', color: 'var(--m-ink)', fontSize: '12px' }}
                formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="var(--m-accent)" strokeWidth={2} fill="url(#heroFill)" isAnimationActive animationDuration={700} />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-2 text-xs mt-5 pt-5" style={{ borderTop: '1px solid var(--m-border)', color: 'var(--m-ink-faint)' }}>
            <CheckCircle2 size={14} style={{ color: 'var(--m-sage)' }} />
            Synced with Airbnb & Booking.com · 4 minutes ago
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { value: '10+', label: 'Booking channels synced' },
    { value: '1–100', label: 'Properties on one plan or many' },
    { value: '5', label: 'Automated guest messages, start to finish' },
  ];
  return (
    <section className="py-10" style={{ borderTop: '1px solid var(--m-border)', borderBottom: '1px solid var(--m-border)', background: 'var(--m-ground-raised)' }}>
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {items.map((item, idx) => (
          <div key={idx}>
            <p className="text-2xl font-medium m-tabular" style={{ fontFamily: 'var(--font-fraunces), serif', color: 'var(--m-accent)' }}>{item.value}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--m-ink-soft)' }} dangerouslySetInnerHTML={{ __html: item.label }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: 'Connect what you already use',
      desc: 'Link your Airbnb and Booking.com listings. Your existing calendar and reservations pull in — nothing to re-enter by hand.',
    },
    {
      title: 'Stop switching apps',
      desc: 'A new booking, a guest question, a cleaner finishing a turnover — it all shows up in one place instead of three different apps.',
    },
    {
      title: 'Know what you actually made',
      desc: 'Revenue and expenses update themselves as bookings and payouts come in — no month-end spreadsheet reconciliation.',
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-16">
          <p className="m-eyebrow mb-3">How it works</p>
          <h2 className="text-4xl font-medium" style={{ color: 'var(--m-ink)' }}>
            Set up once. Run every day from here.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-2xl overflow-hidden" style={{ background: 'var(--m-border)' }}>
          {steps.map((step, idx) => (
            <div key={idx} className="p-8" style={{ background: 'var(--m-card)' }}>
              <p className="text-sm font-medium mb-4 m-tabular" style={{ color: 'var(--m-accent)' }}>
                {String(idx + 1).padStart(2, '0')}
              </p>
              <h3 className="text-xl font-medium mb-2" style={{ color: 'var(--m-ink)', fontFamily: 'var(--font-fraunces), serif' }}>{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--m-ink-soft)' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services() {
  const services = [
    {
      icon: Link2,
      title: 'Channel sync',
      desc: 'Airbnb and Booking.com calendars, rates, and availability stay in sync automatically.',
    },
    {
      icon: Calendar,
      title: 'Universal calendar',
      desc: 'Every reservation, block, and last-minute request across all properties, one view.',
    },
    {
      icon: Sparkles,
      title: 'Guest communication',
      desc: 'Check-in details, house rules, and follow-ups — every conversation in one thread.',
    },
    {
      icon: ClipboardCheck,
      title: 'Housekeeping',
      desc: 'A turnover task is created the moment a guest checks out — do it yourself, or assign it to a cleaner or your whole team.',
    },
    {
      icon: Wrench,
      title: 'Maintenance & vendors',
      desc: 'Log a leaky tap or a broken AC, track it to done — across one property or every property you manage.',
    },
    {
      icon: Wallet,
      title: 'Revenue & expenses',
      desc: 'Every rupee in and out, by property, updated as bookings and payouts land.',
    },
  ];

  return (
    <section className="py-24" style={{ background: 'var(--m-ground-raised)' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-16">
          <p className="m-eyebrow mb-3">Everything included</p>
          <h2 className="text-4xl font-medium" style={{ color: 'var(--m-ink)' }}>
            The whole operation, not a slice of it.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service, idx) => {
            const Icon = service.icon;
            return (
              <div key={idx} className="p-6 rounded-2xl" style={{ background: 'var(--m-card)', border: '1px solid var(--m-border)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--m-accent-tint)' }}>
                  <Icon size={18} style={{ color: 'var(--m-accent-deep)' }} />
                </div>
                <h3 className="text-base font-semibold mb-1.5" style={{ color: 'var(--m-ink)' }}>{service.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--m-ink-soft)' }}>{service.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OwnerPortal() {
  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="rounded-3xl p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center" style={{ background: 'var(--m-card)', border: '1px solid var(--m-border)' }}>
          <div>
            <p className="m-eyebrow mb-3">Owner visibility</p>
            <h2 className="text-3xl font-medium mb-4" style={{ color: 'var(--m-ink)' }}>
              Full visibility. Zero guesswork.
            </h2>
            <p className="mb-6 text-base leading-relaxed" style={{ color: 'var(--m-ink-soft)' }}>
              Every property owner sees live bookings, earnings, and expenses. No waiting on
              someone else's report to know what a property actually earned.
            </p>
            <ul className="space-y-3">
              {['Revenue and expenses by property', 'Upcoming bookings and occupancy', 'Month-over-month comparisons'].map((f, idx) => (
                <li key={idx} className="flex gap-2.5 items-start text-sm" style={{ color: 'var(--m-ink)' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--m-sage)', flexShrink: 0, marginTop: '2px' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl p-6" style={{ background: 'var(--m-ground-raised)' }}>
            <p className="text-xs mb-4" style={{ color: 'var(--m-ink-faint)' }}>Net income trend</p>
            <ResponsiveContainer width="100%" height={200}>
              <RechartsBarChart data={[
                { month: 'Mar', net: 72000 },
                { month: 'Apr', net: 70000 },
                { month: 'May', net: 77000 },
                { month: 'Jun', net: 68000 },
                { month: 'Jul', net: 81000 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--m-border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--m-ink-faint)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--m-ink-faint)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: 'var(--m-card)', border: '1px solid var(--m-border)', borderRadius: '10px', color: 'var(--m-ink)', fontSize: '12px' }}
                  formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Net income']}
                />
                <Bar dataKey="net" fill="var(--m-accent)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  const ownerReasons = [
    { title: 'Fuller calendars', desc: 'Sync across 10+ channels keeps your property visible without manual double-checking.' },
    { title: 'Less chaos', desc: 'No spreadsheets. No missed guest messages. No maintenance request falling through.' },
    { title: 'Real transparency', desc: 'Every rupee in and out, in real time — no waiting on someone else’s report.' },
  ];
  const pmcReasons = [
    { title: 'One view of every property', desc: 'Staff, vendors, and owners all working off the same live calendar and task board.' },
    { title: 'Owners see for themselves', desc: 'Give every owner their own portal instead of fielding "how did my property do" calls.' },
    { title: 'Scales without new hires', desc: 'Add properties without adding a person to manually track each one.' },
  ];

  return (
    <section className="py-24" style={{ background: 'var(--m-ground-raised)' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-16">
          <p className="m-eyebrow mb-3">Why owners &amp; PMCs choose Hostezy</p>
          <h2 className="text-4xl font-medium" style={{ color: 'var(--m-ink)' }}>
            Built for how short-stay actually runs.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <p className="text-sm font-semibold mb-8" style={{ color: 'var(--m-accent)' }}>For property owners</p>
            <div className="space-y-8">
              {ownerReasons.map((reason, idx) => (
                <div key={idx}>
                  <h3 className="text-lg font-medium mb-1.5" style={{ color: 'var(--m-ink)', fontFamily: 'var(--font-fraunces), serif' }}>{reason.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--m-ink-soft)' }}>{reason.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-8" style={{ color: 'var(--m-accent)' }}>For property management companies</p>
            <div className="space-y-8">
              {pmcReasons.map((reason, idx) => (
                <div key={idx}>
                  <h3 className="text-lg font-medium mb-1.5" style={{ color: 'var(--m-ink)', fontFamily: 'var(--font-fraunces), serif' }}>{reason.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--m-ink-soft)' }}>{reason.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl sm:text-5xl font-medium mb-4" style={{ color: 'var(--m-ink)' }}>
          Ready to run your properties better?
        </h2>
        <p className="text-lg mb-9" style={{ color: 'var(--m-ink-soft)' }}>
          Start with a 14-day free trial. No card required.
        </p>
        <Link
          href="/auth/signin"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold transition-transform hover:scale-[1.02] active:scale-95"
          style={{ background: 'var(--m-accent)', color: '#FFFDF9' }}
        >
          Get started
          <ArrowRight size={18} />
        </Link>
        <p className="text-sm mt-6" style={{ color: 'var(--m-ink-faint)' }}>
          Simple onboarding. No lock-in contracts.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12" style={{ borderTop: '1px solid var(--m-border)' }}>
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: 'var(--m-accent)', color: '#FFFDF9', fontFamily: 'var(--font-fraunces), serif' }}>
            A
          </div>
          <div>
            <p className="font-medium" style={{ color: 'var(--m-ink)', fontFamily: 'var(--font-fraunces), serif' }}>Hostezy</p>
            <p className="text-xs" style={{ color: 'var(--m-ink-faint)' }}>Property management, simplified.</p>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--m-ink-faint)' }}>© 2026 Hostezy. All rights reserved.</p>
      </div>
    </footer>
  );
}
