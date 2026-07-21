import type { LucideIcon } from 'lucide-react';

type Props = {
  icon?: LucideIcon;
  message: string;
  action?: React.ReactNode;
};

export default function EmptyState({ icon: Icon, message, action }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-12 text-center">
      {Icon && <Icon className="h-8 w-8 mx-auto mb-3 text-[var(--text-tertiary)]" />}
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
