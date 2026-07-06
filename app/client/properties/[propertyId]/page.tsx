import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import PropertyFinanceContent from '@/components/property/PropertyFinanceContent';

async function checkAccessAndGetProperty(userId: string, propertyId: string) {
  const db = createServiceRoleClient();
  const [propRes, accessRes] = await Promise.all([
    db.from('properties').select('id, name').eq('id', propertyId).maybeSingle(),
    db.from('property_access').select('id').eq('property_id', propertyId).eq('user_id', userId).maybeSingle(),
  ]);
  return { property: propRes.data, hasAccess: !!accessRes.data };
}

export default async function ClientPropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const user = await getUser();
  if (!user) redirect('/auth/signin');

  const { property, hasAccess } = await checkAccessAndGetProperty(user.id, propertyId);
  if (!property || !hasAccess) notFound();

  return (
    <PropertyFinanceContent
      propertyId={property.id}
      propertyName={property.name}
      isReadOnly={true}
    />
  );
}
