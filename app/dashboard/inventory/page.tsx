import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { InventoryManager } from './InventoryManager';
import PageHeader from '@/components/ui/PageHeader';

export default async function InventoryPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Inventory" subtitle="Track supplies and get low-stock alerts" />
      <InventoryManager />
    </div>
  );
}
