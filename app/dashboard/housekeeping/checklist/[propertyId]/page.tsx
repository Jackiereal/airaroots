import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClientLoose } from '@/src/infrastructure/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { ChecklistEditor } from './ChecklistEditor';

async function getPageData(propertyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin');

  // Fetch property name
  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .single();
  if (!property) return null;

  const svcClient = createServiceRoleClientLoose();
  const service = new HousekeepingService(svcClient);

  // Check if a custom template exists
  const raw = await svcClient
    .from('housekeeping_checklist_templates')
    .select('items')
    .eq('property_id', propertyId)
    .maybeSingle();

  const isCustom = !!raw.data;
  const items = await service.getTemplate(propertyId);

  return { property, items, isCustom };
}

export default async function ChecklistTemplatePage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const data = await getPageData(propertyId);
  if (!data) notFound();

  const { property, items, isCustom } = data;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/dashboard/housekeeping" className="hover:text-[var(--text-secondary)] transition-colors">
          Housekeeping
        </Link>
        <span>›</span>
        <span>Checklist Template</span>
      </div>

      <ChecklistEditor
        propertyId={propertyId}
        propertyName={property.name}
        initialItems={items}
        isCustom={isCustom}
      />
    </div>
  );
}
