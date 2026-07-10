import { writeAuditLog } from '@/lib/admin/audit';
import { requireOrgWrite } from '@/src/shared/utils/route-auth';
import { directBookingAuditSnapshot, auditSnapshotsEqual } from '@/lib/property-finance/audit-snapshots';
import { createServiceRoleClient, createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<boolean> {
  const db = createServiceRoleClientLoose();
  const { data } = await db.from('properties').select('organization_id').eq('id', propertyId).maybeSingle();
  return !!data && data.organization_id === organizationId;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ propertyId: string; id: string }> }) {
  const { propertyId, id } = await params;
  const { error: authError, ctx } = await requireOrgWrite();
  if (authError) return authError;
  if (!(await assertPropertyInOrg(propertyId, ctx!.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = createServiceRoleClient();
  const { data: existing } = await db
    .from('property_finance_direct_bookings')
    .select('*').eq('id', id).eq('property_id', propertyId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  const fields = ['guest_name', 'amount', 'guest_count', 'guest_phone', 'received_date', 'check_in', 'check_out', 'nights', 'notes'];
  for (const f of fields) {
    if (f in body) updateData[f] = body[f] !== '' ? body[f] : null;
  }

  const beforeSnap = directBookingAuditSnapshot(existing as unknown as Record<string, unknown>);
  const { data: updated, error } = await createServiceRoleClientLoose()
    .from('property_finance_direct_bookings')
    .update(updateData).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const afterSnap = directBookingAuditSnapshot(updated as unknown as Record<string, unknown>);
  if (!auditSnapshotsEqual(beforeSnap, afterSnap)) {
    void writeAuditLog({
      userId: ctx!.userId, propertyId, action: 'update',
      resourceType: 'property_finance_direct_booking', resourceId: id,
      beforeState: beforeSnap, afterState: afterSnap,
    });
  }
  return NextResponse.json({ directBooking: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ propertyId: string; id: string }> }) {
  const { propertyId, id } = await params;
  const { error: authError, ctx } = await requireOrgWrite();
  if (authError) return authError;
  if (!(await assertPropertyInOrg(propertyId, ctx!.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = createServiceRoleClient();
  const { data: existing } = await db
    .from('property_finance_direct_bookings')
    .select('*').eq('id', id).eq('property_id', propertyId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await db.from('property_finance_direct_bookings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void writeAuditLog({
    userId: ctx!.userId, propertyId, action: 'delete',
    resourceType: 'property_finance_direct_booking', resourceId: id,
    beforeState: directBookingAuditSnapshot(existing as unknown as Record<string, unknown>),
  });
  return NextResponse.json({ ok: true });
}
