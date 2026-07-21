import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { VendorManager } from './VendorManager';

export default async function VendorsPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-fraunces)] text-[var(--text-primary)]">
          Vendors
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Manage maintenance vendors and contractors
        </p>
      </div>
      <VendorManager />
    </div>
  );
}
