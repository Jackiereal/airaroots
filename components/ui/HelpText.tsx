import { HelpCircle } from 'lucide-react';

type Props = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

// Collapsed inline explanation for jargon or non-obvious features.
// Use for "what is this / why use it" callouts — not for form validation
// or errors, which should stay inline near the relevant field.
export default function HelpText({ label, children, className = '' }: Props) {
  return (
    <details className={`text-xs ${className}`} style={{ color: 'var(--text-tertiary)' }}>
      <summary className="cursor-pointer list-none flex items-center gap-1.5 hover:underline underline-offset-2 marker:hidden [&::-webkit-details-marker]:hidden">
        <HelpCircle size={13} className="shrink-0" />
        {label}
      </summary>
      <div className="mt-2 ml-[19px]" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </details>
  );
}
