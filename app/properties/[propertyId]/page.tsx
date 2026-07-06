import { notFound, redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import PropertyFinanceContent from '@/components/property/PropertyFinanceContent';

async function getProperty(id: string) {
  const db = createServiceRoleClient();
  const { data } = await db.from('properties').select('id, name').eq('id', id).maybeSingle();
  return data;
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');
  if (profile.role !== 'admin') redirect('/client/dashboard');

  const property = await getProperty(propertyId);
  if (!property) notFound();

  return (
    <PropertyFinanceContent
      propertyId={property.id}
      propertyName={property.name}
      isReadOnly={false}
    />
  );
}
