import type { ChannelConnectionStatus } from '@/src/domains/channel/types';

const CONFIG: Record<ChannelConnectionStatus, { label: string; color: string }> = {
  active:       { label: 'Active',       color: 'var(--color-green)' },
  paused:       { label: 'Paused',       color: 'var(--color-amber)' },
  error:        { label: 'Error',        color: 'var(--color-red)' },
  disconnected: { label: 'Disconnected', color: 'var(--text-tertiary)' },
};

export function ChannelStatusBadge({ status }: { status: ChannelConnectionStatus }) {
  const { label, color } = CONFIG[status] ?? { label: status, color: 'var(--text-tertiary)' };
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
