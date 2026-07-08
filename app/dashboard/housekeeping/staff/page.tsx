import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { StaffManager } from './StaffManager';

export default async function HousekeepingStaffPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
          Housekeeping Staff
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Manage your cleaning team
        </p>
      </div>
      <StaffManager />
    </div>
  );
}
