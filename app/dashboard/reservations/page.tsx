import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { ReservationListClient } from './ReservationListClient';

export default async function ReservationsPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
          Reservations
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">All reservations across properties</p>
      </div>
      <ReservationListClient />
    </div>
  );
}
