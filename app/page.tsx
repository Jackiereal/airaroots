'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { Megaphone, Calendar, Star, Wrench, BarChart3, LineChart, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.role === 'admin') {
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--border-color)] border-t-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }} className="min-h-screen">
      <Nav />
      <Hero />
      <HowItWorks />
      <Services />
      <OwnerPortal />
      <WhyAiraroots />
      <SocialProof />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur border-b" style={{ background: 'rgba(13, 13, 13, 0.95)', borderColor: 'var(--border-subtle)' }}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
            A
          </div>
          <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>
            Airaroots
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/auth/signin" className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
            Owner Login
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Subtle radial glow */}
      <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{
        background: 'radial-gradient(ellipse 800px 400px at center bottom, rgba(29, 185, 84, 0.07) 0%, transparent 70%)'
      }} />

      <div className="relative max-w-4xl mx-auto px-6 py-24 sm:py-32 text-center">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-tight mb-6" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>
          Own the Property.<br />
          We Handle<br />
          Everything Else.
        </h1>

        <p className="text-lg sm:text-xl mb-12 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Airaroots manages your rental property end-to-end — from marketing and bookings to operations and guest experience. You collect the income. We do the work.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/auth/signin" className="px-8 py-4 rounded-lg text-base font-semibold transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
            List Your Property
            <ArrowRight className="inline ml-2" size={18} />
          </Link>
          <Link href="/auth/signin" className="px-8 py-4 rounded-lg text-base font-semibold border transition-all hover:scale-105 active:scale-95" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            Owner Login
          </Link>
        </div>

        {/* Hero visual mockup */}
        <div className="max-w-2xl mx-auto p-8 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
          <h3 className="text-sm font-semibold mb-6" style={{ color: 'var(--text-secondary)' }}>Your Property at a Glance</h3>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Revenue card */}
            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Earned</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>$8,240</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>This month</p>
            </div>

            {/* Bookings card */}
            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Bookings</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>14</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>87% occupancy</p>
            </div>

            {/* Expenses card */}
            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Expenses</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-red)' }}>$1,240</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Managed</p>
            </div>
          </div>

          {/* Mini chart */}
          <div className="flex items-end justify-center gap-2 mb-6 h-24">
            {[5, 8, 6, 9, 7, 8, 9].map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${(h / 9) * 100}%`, background: 'var(--accent)' }} />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />
            Managed by Airaroots
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      num: 1,
      title: 'List Your Property',
      desc: 'Tell us about your property. We assess, onboard, and get it ready for bookings.'
    },
    {
      num: 2,
      title: 'We Manage Everything',
      desc: 'Marketing, bookings, guest communication, cleaning, maintenance — all handled.'
    },
    {
      num: 3,
      title: 'You Earn & Track',
      desc: 'Log in anytime to see your revenue, bookings, and property performance.'
    }
  ];

  return (
    <section id="how-it-works" className="py-24" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>
            How We Work
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Simple, transparent process</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className="absolute top-8 -right-4 w-8 h-0.5 md:block hidden" style={{ background: 'var(--border-color)' }} />
              )}

              <div className="p-6 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 font-bold text-sm" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
                  {step.num}
                </div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{step.desc}</p>
              </div>
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
      icon: Megaphone,
      title: 'Multi-Channel Marketing',
      desc: 'Listed on Airbnb, Vrbo, Booking.com and more. We write listings, optimize photos, and maximize visibility.'
    },
    {
      icon: Calendar,
      title: 'Booking Management',
      desc: 'We handle all reservations, dynamic pricing, availability, and last-minute requests. Zero effort from you.'
    },
    {
      icon: Star,
      title: 'Guest Experience',
      desc: 'Check-in, communication, reviews, and resolution — every guest interaction managed by our team.'
    },
    {
      icon: Wrench,
      title: 'Operations & Maintenance',
      desc: 'Cleaning schedules, routine checks, and maintenance requests handled before they become problems.'
    },
    {
      icon: BarChart3,
      title: 'Revenue Optimization',
      desc: 'Dynamic pricing based on market demand, seasonality, and local events to maximize your earnings.'
    },
    {
      icon: LineChart,
      title: 'Performance Reporting',
      desc: 'Monthly reports, real-time dashboards, and expense breakdowns so you always know your numbers.'
    }
  ];

  return (
    <section className="py-24" style={{ background: 'var(--bg-raised)' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>
            Everything Your Property Needs
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Done for you</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, idx) => {
            const Icon = service.icon;
            return (
              <div key={idx} className="p-6 rounded-xl" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}>
                <Icon size={28} className="mb-4" style={{ color: 'var(--accent)' }} />
                <h3 className="text-lg font-bold mb-2">{service.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{service.desc}</p>
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
    <section className="py-24" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="p-8 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '3px solid var(--accent)' }}>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>
            Full Visibility. Zero Guesswork.
          </h2>
          <p className="mb-8 text-lg" style={{ color: 'var(--text-secondary)' }}>
            Every property owner gets a private portal with live data — your bookings, earnings, expenses, and net income. Understand exactly what you're earning and why.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {['Real-time revenue and expense breakdown', 'Upcoming bookings and occupancy calendar', 'Month-over-month performance comparisons', 'Net income after all fees and costs'].map((feature, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <CheckCircle2 size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: 'var(--text-primary)' }}>{feature}</span>
              </div>
            ))}
          </div>

          {/* Portal mockup */}
          <div className="p-6 rounded-xl" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}>
            <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Sample Owner Dashboard</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Earned</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>$12,480</p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Expenses</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-red)' }}>$2,240</p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Net Income</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-gold)' }}>$10,240</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyAiraroots() {
  const reasons = [
    {
      title: 'More Bookings',
      desc: 'Our marketing across 10+ channels fills your calendar better than managing alone.'
    },
    {
      title: 'Less Stress',
      desc: 'No guest messages at 2am. No chasing cleaners. No maintenance emergencies landing on you.'
    },
    {
      title: 'Full Transparency',
      desc: 'Unlike traditional property managers, you see every dollar in and out, in real time.'
    }
  ];

  return (
    <section className="py-24" style={{ background: 'var(--bg-raised)' }}>
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center mb-16" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>
          Why Property Owners Choose Airaroots
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reasons.map((reason, idx) => (
            <div key={idx} className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
                <span className="text-2xl font-bold">{idx + 1}</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">{reason.title}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{reason.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="py-16" style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>100%</p>
            <p style={{ color: 'var(--text-secondary)' }}>Fully Managed</p>
          </div>
          <div>
            <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>10+</p>
            <p style={{ color: 'var(--text-secondary)' }}>Booking Channels</p>
          </div>
          <div>
            <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>Real-Time</p>
            <p style={{ color: 'var(--text-secondary)' }}>Reporting</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-24" style={{ background: 'var(--bg-surface)', borderTop: '2px solid var(--accent)' }}>
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>
          Ready to Put Your Property to Work?
        </h2>
        <p className="text-lg mb-8" style={{ color: 'var(--text-secondary)' }}>
          List with Airaroots. We handle the rest.
        </p>
        <Link href="/auth/signin" className="inline-block px-8 py-4 rounded-lg text-base font-semibold transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
          Get Started
          <ArrowRight className="inline ml-2" size={18} />
        </Link>
        <p className="text-sm mt-6" style={{ color: 'var(--text-tertiary)' }}>
          Simple onboarding. No lock-in contracts.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-12" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-color)' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-3 mb-6 md:mb-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
              A
            </div>
            <div>
              <p className="font-semibold">Airaroots</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Property management, simplified.</p>
            </div>
          </div>
          <p style={{ color: 'var(--text-tertiary)' }}>© 2025 Airaroots. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
