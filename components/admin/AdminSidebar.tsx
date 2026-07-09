'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Building2, LayoutDashboard, Users, LogOut, ChevronRight, Calendar, BookOpen, Link2, ClipboardCheck, Wrench, Package, HardHat } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import MobileSidebarShell from '@/components/ui/MobileSidebarShell';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/reservations', label: 'Reservations', icon: BookOpen },
  { href: '/dashboard/channels', label: 'Channels', icon: Link2 },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
];

const OPS_NAV = [
  { href: '/dashboard/housekeeping', label: 'Housekeeping', icon: ClipboardCheck },
  { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/dashboard/vendors', label: 'Vendors', icon: HardHat },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Package },
];

export default function AdminSidebar({ email }: { email?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = () => {
    const supabase = createClient();
    supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <MobileSidebarShell>
      <SidebarContent email={email} pathname={pathname} onSignOut={handleSignOut} />
    </MobileSidebarShell>
  );
}

function SidebarContent({
  email,
  pathname,
  onSignOut,
}: {
  email?: string;
  pathname: string;
  onSignOut: () => void;
}) {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-4">
        <Building2 className="h-5 w-5 text-[var(--accent)]" />
        <span className="font-semibold text-[var(--text-primary)] font-[family-name:var(--font-rajdhani)] text-lg">
          Airaroots
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />}
            </Link>
          );
        })}

        <p className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Operations</p>
        {OPS_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border-color)] p-3">
        <p className="mb-1.5 truncate px-1 text-xs text-[var(--text-tertiary)]">{email}</p>
        <ThemeToggle />
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
