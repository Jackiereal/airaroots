'use client';

import { useState } from 'react';
import BreakevenCalculator from './BreakevenCalculator';
import CashFlowProjections from './CashFlowProjections';
import DebtFreePlanner from './DebtFreePlanner';
import PricingSimulator from './PricingSimulator';
import RecommendationsPanel from './RecommendationsPanel';
import BusinessValuation from './BusinessValuation';
import MarketingSimulator from './MarketingSimulator';

type PlanningTab = 'cashflow' | 'debtfree' | 'pricing' | 'breakeven' | 'valuation' | 'marketing' | 'recommendations';

const TABS: { id: PlanningTab; label: string }[] = [
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'breakeven', label: 'Breakeven' },
  { id: 'debtfree', label: 'Debt-Free Planner' },
  { id: 'pricing', label: 'Pricing Simulator' },
  { id: 'valuation', label: 'Valuation' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'recommendations', label: '✦ AI Advisor' },
];

export default function PlanningHub({ propertyId }: { propertyId: string }) {
  const [active, setActive] = useState<PlanningTab>('cashflow');

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="max-w-full overflow-x-auto overscroll-x-contain touch-pan-x">
        <div className="flex gap-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={[
                'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                active === tab.id
                  ? 'bg-[var(--bg-raised)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {active === 'cashflow' && <CashFlowProjections propertyId={propertyId} />}
      {active === 'breakeven' && <BreakevenCalculator propertyId={propertyId} />}
      {active === 'debtfree' && <DebtFreePlanner propertyId={propertyId} />}
      {active === 'pricing' && <PricingSimulator propertyId={propertyId} />}
      {active === 'valuation' && <BusinessValuation propertyId={propertyId} />}
      {active === 'marketing' && <MarketingSimulator propertyId={propertyId} />}
      {active === 'recommendations' && <RecommendationsPanel propertyId={propertyId} />}
    </div>
  );
}
