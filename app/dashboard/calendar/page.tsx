import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ReservationCalendar } from '@/components/calendar/ReservationCalendar';

async function getProperties() {
  const db = createServiceRoleClient();
  const { data } = await db.from('properties').select('id, name').order('name');
  return (data ?? []) as { id: string; name: string }[];
}

export default async function CalendarPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  const properties = await getProperties();

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-fraunces)] text-[var(--text-primary)]">
          Calendar
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          All properties · {properties.length} {properties.length === 1 ? 'property' : 'properties'}
        </p>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No properties yet. Add a property first.</p>
        </div>
      ) : (
        <ReservationCalendar properties={properties} />
      )}
    </div>
  );
}
