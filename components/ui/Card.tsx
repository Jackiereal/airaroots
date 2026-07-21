type Props = {
  children: React.ReactNode;
  className?: string;
  padding?: 'default' | 'compact' | 'responsive' | 'none';
};

const PADDING = {
  default: 'p-5',
  compact: 'p-3',
  responsive: 'p-4 sm:p-5',
  none: '',
};

export default function Card({ children, className = '', padding = 'default' }: Props) {
  return (
    <div
      className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] ${PADDING[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
