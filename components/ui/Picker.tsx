'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export type PickerOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  size?: 'default' | 'compact';
  className?: string;
  searchable?: boolean;
  modalTitle?: string;
};

export default function Picker({
  value,
  onChange,
  options,
  placeholder,
  label,
  disabled = false,
  size = 'default',
  className = '',
  searchable = false,
  modalTitle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const hasEmptyOption = options.some((o) => o.value === '');
  const allOptions = placeholder && !hasEmptyOption
    ? [{ value: '', label: placeholder }, ...options]
    : options;

  const selected = allOptions.find((o) => o.value === value);
  const triggerLabel = selected?.label ?? placeholder ?? 'Select…';

  const filteredOptions = searchable && query.trim()
    ? allOptions.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : allOptions;

  function handleSelect(option: PickerOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  const triggerClassName = size === 'compact'
    ? 'inline-flex items-center gap-1 shrink-0 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)] disabled:opacity-50'
    : 'min-h-11 inline-flex items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] disabled:opacity-50';

  return (
    <div className={size === 'compact' ? 'inline-block' : 'block'}>
      {label && (
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{label}</label>
      )}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={`${triggerClassName} ${className}`}
          >
            <span className={`truncate ${!selected?.label && !placeholder ? 'text-[var(--text-tertiary)]' : ''}`}>
              {triggerLabel}
            </span>
            <ChevronDown size={size === 'compact' ? 12 : 15} className="shrink-0 text-[var(--text-tertiary)]" />
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[200]" />
          <Dialog.Content
            className="fixed inset-x-0 bottom-0 z-[200] max-h-[80vh] overflow-hidden rounded-t-2xl border-t border-[var(--border-color)] bg-[var(--bg-base)] pb-[env(safe-area-inset-bottom)] flex flex-col sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(90vw,22rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] shrink-0">
              <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">
                {modalTitle ?? label ?? placeholder ?? 'Select'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>

            {searchable && (
              <div className="px-5 py-3 border-b border-[var(--border-color)] shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    className="min-h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>
            )}

            <div className="overflow-y-auto py-2">
              {filteredOptions.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center text-[var(--text-tertiary)]">No matches.</p>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => handleSelect(option)}
                      className={`min-h-11 flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left text-sm transition-colors disabled:opacity-40 ${
                        isSelected
                          ? 'text-[var(--accent)] font-medium'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span className="block truncate text-xs text-[var(--text-tertiary)]">{option.description}</span>
                        )}
                      </span>
                      {isSelected && <Check size={16} className="shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
