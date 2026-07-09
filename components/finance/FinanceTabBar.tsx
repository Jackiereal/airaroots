'use client';

export type FinanceTab = 'overview' | 'revenue' | 'expenses' | 'bookings' | 'planning';

const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'planning', label: 'Planning' },
];

export default function FinanceTabBar({
  active,
  onChange,
  isReadOnly = false,
}: {
  active: FinanceTab;
  onChange: (tab: FinanceTab) => void;
  isReadOnly?: boolean;
}) {
  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain touch-pan-x">
      <div className="flex gap-0.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-1 w-fit">
        {TABS.filter((tab) => !(isReadOnly && tab.id === 'planning')).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
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
  );
}
