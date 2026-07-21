type Variant = 'income' | 'profit' | 'amber' | 'rose' | 'violet' | 'neutral';

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

const VARIANT_STYLE: Record<Variant, { bg: string; border: string; text: string }> = {
  income: { bg: 'var(--tone-income-bg)', border: 'var(--tone-income-bd)', text: 'var(--tone-income-tx)' },
  profit: { bg: 'var(--tone-profit-bg)', border: 'var(--tone-profit-bd)', text: 'var(--tone-profit-tx)' },
  amber: { bg: 'var(--tone-amber-bg)', border: 'var(--tone-amber-bd)', text: 'var(--tone-amber-tx)' },
  rose: { bg: 'var(--tone-rose-bg)', border: 'var(--tone-rose-bd)', text: 'var(--tone-rose-tx)' },
  violet: { bg: 'var(--tone-violet-bg)', border: 'var(--tone-violet-bd)', text: 'var(--tone-violet-tx)' },
  neutral: { bg: 'var(--bg-elevated)', border: 'var(--border-color)', text: 'var(--text-secondary)' },
};

// Status pill wrapping the app's tone tokens — use for reservation status,
// payment status, sync results, anything communicating a categorical state.
export default function Badge({ children, variant = 'neutral', className = '' }: Props) {
  const style = VARIANT_STYLE[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
      style={{ background: style.bg, borderColor: style.border, color: style.text }}
    >
      {children}
    </span>
  );
}
