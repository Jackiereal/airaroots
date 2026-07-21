type Props = {
  children: React.ReactNode;
  className?: string;
  padding?: 'default' | 'compact' | 'none';
};

const PADDING = {
  default: 'p-5',
  compact: 'p-3',
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
