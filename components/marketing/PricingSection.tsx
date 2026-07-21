'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { PLAN_LABELS, PLAN_PROPERTY_LIMITS, type Plan } from '@/src/domains/billing/constants';

const INDIVIDUAL_TIERS: Plan[] = ['solo', 'small'];
const PMC_TIERS: Plan[] = ['growth', 'pro'];

type PlanRow = { plan: Plan; amount_paise: number; currency: string; billing_period: string };

function limitLabel(plan: Plan): string {
  const limit = PLAN_PROPERTY_LIMITS[plan];
  return limit === null ? 'Unlimited properties' : limit === 1 ? '1 property' : `Up to ${limit} properties`;
}

function formatPrice(amountPaise: number, currency: string): string {
  const amount = amountPaise / 100;
  return `${currency === 'INR' ? '₹' : currency} ${amount.toLocaleString('en-IN')}`;
}

export default function PricingSection() {
  const [plans, setPlans] = useState<Record<string, PlanRow>>({});

  useEffect(() => {
    fetch('/api/billing/plans')
      .then((res) => res.json())
      .then((d) => {
        const map: Record<string, PlanRow> = {};
        for (const row of d.plans ?? []) map[row.plan] = row;
        setPlans(map);
      })
      .catch(() => {});
  }, []);

  function priceLabel(plan: Plan): string {
    const row = plans[plan];
    return row ? formatPrice(row.amount_paise, row.currency) : '…';
  }

  return (
    <section id="pricing" className="py-24" style={{ background: 'var(--m-ground-raised)' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-xl mb-4">
          <p className="m-eyebrow mb-3">Pricing</p>
          <h2 className="text-4xl font-medium mb-4" style={{ color: 'var(--m-ink)' }}>
            Sized for how you work.
          </h2>
          <p style={{ color: 'var(--m-ink-soft)' }}>
            Whether you own one property or run a portfolio for others, there's a plan built for you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--m-ink)' }}>For property owners</h3>
              <p className="text-sm" style={{ color: 'var(--m-ink-soft)' }}>
                Replace the spreadsheet and WhatsApp juggling with one place to manage bookings — no operations team needed.
              </p>
            </div>
            <div className="space-y-4">
              {INDIVIDUAL_TIERS.map((plan) => (
                <PlanCard key={plan} plan={plan} price={priceLabel(plan)} />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--m-ink)' }}>For property management companies</h3>
              <p className="text-sm" style={{ color: 'var(--m-ink-soft)' }}>
                Built for teams — housekeeping boards, vendor coordination, multi-property reporting, and staff logins.
              </p>
            </div>
            <div className="space-y-4">
              {PMC_TIERS.map((plan) => (
                <PlanCard key={plan} plan={plan} price={priceLabel(plan)} />
              ))}
              <div className="p-5 rounded-2xl flex items-center justify-between" style={{ background: 'var(--m-card)', border: '1px solid var(--m-border)' }}>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--m-ink)' }}>{PLAN_LABELS.enterprise}</p>
                  <p className="text-sm" style={{ color: 'var(--m-ink-soft)' }}>25+ properties, negotiated terms</p>
                </div>
                <a
                  href="mailto:teja.jackie@gmail.com?subject=Airaroots%20Enterprise%20plan"
                  className="text-sm font-semibold"
                  style={{ color: 'var(--m-accent)' }}
                >
                  Contact us
                </a>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-sm mt-12 max-w-2xl mx-auto" style={{ color: 'var(--m-ink-faint)' }}>
          All plans include the same core toolset — reservations, calendar, channel sync, housekeeping, maintenance, and finance tracking.
          Higher tiers exist for portfolio size, not fewer features.
        </p>
      </div>
    </section>
  );
}

function PlanCard({ plan, price }: { plan: Plan; price: string }) {
  return (
    <div className="p-5 rounded-2xl" style={{ background: 'var(--m-card)', border: '1px solid var(--m-border)' }}>
      <div className="flex items-baseline justify-between mb-1">
        <p className="font-semibold text-lg" style={{ color: 'var(--m-ink)', fontFamily: 'var(--font-fraunces), serif' }}>{PLAN_LABELS[plan]}</p>
        <p className="font-medium m-tabular" style={{ color: 'var(--m-accent)' }}>
          {price}
          <span className="text-xs font-normal" style={{ color: 'var(--m-ink-faint)' }}>/mo</span>
        </p>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--m-ink-soft)' }}>{limitLabel(plan)}</p>
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--m-ink-faint)' }}>
        <CheckCircle2 size={14} style={{ color: 'var(--m-sage)' }} />
        Every feature included
      </div>
    </div>
  );
}
