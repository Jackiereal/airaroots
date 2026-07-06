'use client';

export type FinanceTab = 'overview' | 'revenue' | 'expenses' | 'loans' | 'planning';

const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'loans', label: 'Loans' },
  { id: 'planning', label: 'Planning' },
];

export default function FinanceTabBar({
  active,
  onChange,
}: {
  active: FinanceTab;
  onChange: (tab: FinanceTab) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-1 w-fit">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            active === tab.id
              ? 'bg-[var(--bg-raised)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
