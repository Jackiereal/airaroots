import { notFound } from 'next/navigation';
import { createServiceRoleClientLoose } from '@/src/infrastructure/supabase/server';
import { HousekeepingService } from '@/src/domains/operations/services/housekeeping.service';
import { InventoryService } from '@/src/domains/operations/services/inventory.service';
import { HousekeepingTaskClient } from './HousekeepingTaskClient';

async function getTask(token: string) {
  try {
    const supabase = createServiceRoleClientLoose();
    const service = new HousekeepingService(supabase);
    const task = await service.getTaskByToken(token);
    const inventoryService = new InventoryService(supabase);
    const inventory = await inventoryService.listByProperty(task.propertyId);
    return { task, inventory };
  } catch {
    return null;
  }
}

export default async function HkTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getTask(token);
  if (!data) notFound();

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-6 flex items-center gap-2">
          <span className="font-bold text-lg font-[family-name:var(--font-rajdhani)] text-[var(--accent)]">
            Airaroots
          </span>
          <span className="text-[var(--text-tertiary)] text-sm">· Housekeeping</span>
        </div>
        <HousekeepingTaskClient token={token} initialData={data} />
      </div>
    </div>
  );
}
