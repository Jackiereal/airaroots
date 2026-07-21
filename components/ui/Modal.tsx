'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  width?: string;
};

// Thin wrapper over the mobile-bottom-sheet / desktop-centered Radix Dialog
// chrome already hand-rolled in PropertyFinanceContent.tsx — same markup,
// extracted so new dialogs don't re-implement it.
export default function Modal({ open, onOpenChange, title, children, width = '26rem' }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed z-[101] flex max-h-[min(92dvh,90vh)] flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[90dvh] max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:pb-[env(safe-area-inset-bottom)] sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
          style={{ width: `min(100vw - 1.5rem, ${width})` }}
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
            <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">{title}</Dialog.Title>
            <Dialog.Close
              type="button"
              className="inline-flex shrink-0 min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] sm:min-h-9 sm:min-w-9"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
