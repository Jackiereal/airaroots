'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, X } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  href: string;
  cta: string;
};

type Props = {
  organizationId: string;
  channelConnected: boolean;
  teamInvited: boolean;
};

function dismissKey(organizationId: string) {
  return `hostezy:getting-started-dismissed:${organizationId}`;
}

export default function GettingStartedChecklist({ organizationId, channelConnected, teamInvited }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey(organizationId)) === '1');
  }, [organizationId]);

  const items: ChecklistItem[] = [
    {
      key: 'channel',
      label: 'Connect a booking channel',
      done: channelConnected,
      href: '/dashboard/channels',
      cta: 'Connect',
    },
    {
      key: 'team',
      label: 'Invite a team member',
      done: teamInvited,
      href: '/admin/users',
      cta: 'Invite',
    },
  ];

  const doneCount = items.filter(i => i.done).length;

  if (dismissed || doneCount === items.length) return null;

  function dismiss() {
    localStorage.setItem(dismissKey(organizationId), '1');
    setDismissed(true);
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Getting started</h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            A few things to finish setting up your account.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="neutral">{doneCount}/{items.length} done</Badge>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              {item.done ? (
                <CheckCircle2 size={16} className="text-[var(--tone-income-tx)] shrink-0" />
              ) : (
                <Circle size={16} className="text-[var(--text-tertiary)] shrink-0" />
              )}
              <span className={item.done ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'}>
                {item.label}
              </span>
            </div>
            {!item.done && (
              <Link href={item.href} className="text-xs font-medium text-[var(--accent)] hover:underline underline-offset-2 shrink-0">
                {item.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
