import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { HousekeepingBoard } from './HousekeepingBoard';

export default async function HousekeepingPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
          Housekeeping
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Track cleaning tasks across all properties
        </p>
      </div>
      <HousekeepingBoard />
    </div>
  );
}
