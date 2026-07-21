import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { ReservationListClient } from './ReservationListClient';
import PageHeader from '@/components/ui/PageHeader';

export default async function ReservationsPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Reservations" subtitle="All reservations across properties" />
      <ReservationListClient />
    </div>
  );
}
