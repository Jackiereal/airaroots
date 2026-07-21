'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, Building2 } from 'lucide-react';

type Props = {
  children: React.ReactNode;
};

// Wraps a sidebar's content: renders it inline on md+ screens (unchanged
// desktop behavior), and behind a hamburger-triggered slide-over drawer on
// smaller screens. Closes automatically on route change.
export default function MobileSidebarShell({ children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar — only below md */}
      <div className="flex md:hidden items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[var(--accent)]" />
          <span className="font-semibold text-[var(--text-primary)] font-[family-name:var(--font-fraunces)] text-lg">
            Hostezy
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop sidebar — unchanged, always visible md+ */}
      <div className="hidden md:flex md:h-full md:shrink-0">{children}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex max-w-[85vw]">
            <div className="relative flex h-full w-56 flex-col">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute -right-10 top-3 p-2 rounded-lg text-white/80 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
