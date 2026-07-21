import { Building2 } from 'lucide-react';

// Shared brand header used at the top of both AdminSidebar and ClientSidebar
// (and the mobile top bar) — kept as one place to change the logo/name.
export default function SidebarBrand() {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-4">
      <Building2 className="h-5 w-5 text-[var(--accent)]" />
      <span className="font-semibold text-[var(--text-primary)] font-[family-name:var(--font-fraunces)] text-lg">
        Hostezy
      </span>
    </div>
  );
}
