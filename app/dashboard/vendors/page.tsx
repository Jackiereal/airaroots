import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { VendorManager } from './VendorManager';
import PageHeader from '@/components/ui/PageHeader';

export default async function VendorsPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader title="Vendors" subtitle="Manage maintenance vendors and contractors" />
      <VendorManager />
    </div>
  );
}
