import { writeAuditLog } from '@/lib/admin/audit';
import { requireAdmin } from '@/lib/auth';
import { expenseAuditSnapshot, auditSnapshotsEqual } from '@/lib/property-finance/audit-snapshots';
import { resolveExpensePaidSource } from '@/lib/property-finance/expense-paid-source';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ propertyId: string; id: string }> }) {
  const { propertyId, id } = await params;
  const { error: authError, profile } = await requireAdmin();
  if (authError) return authError;

  const db = createServiceRoleClient();
  const { data: existing, error: fetchErr } = await db
    .from('property_finance_expenses')
    .select('*')
    .eq('id', id)
    .eq('property_id', propertyId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const paidResolved = resolveExpensePaidSource({
    paid_from: (body.paid_from as string | null) ?? existing.paid_from,
    owner_id: (body.owner_id as string | null) ?? existing.owner_id,
  });
  if (!paidResolved.ok) return NextResponse.json({ error: paidResolved.error }, { status: 400 });

  const updateData = {
    expense_type: (body.expense_type as string)?.trim() ?? existing.expense_type,
    amount: body.amount != null ? Number(body.amount) : existing.amount,
    expense_date: body.expense_date !== undefined ? (body.expense_date as string | null) : existing.expense_date,
    notes: body.notes !== undefined ? (body.notes as string | null)?.trim() || null : existing.notes,
    paid_from: paidResolved.paid_from,
    owner_id: paidResolved.owner_id,
  };

  const beforeSnap = expenseAuditSnapshot(existing as unknown as Record<string, unknown>);
  const { data: updated, error } = await db
    .from('property_finance_expenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const afterSnap = expenseAuditSnapshot(updated as unknown as Record<string, unknown>);
  if (!auditSnapshotsEqual(beforeSnap, afterSnap)) {
    void writeAuditLog({
      userId: profile!.id, propertyId, action: 'update',
      resourceType: 'property_finance_expense', resourceId: id,
      beforeState: beforeSnap, afterState: afterSnap,
    });
  }
  return NextResponse.json({ expense: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ propertyId: string; id: string }> }) {
  const { propertyId, id } = await params;
  const { error: authError, profile } = await requireAdmin();
  if (authError) return authError;

  const db = createServiceRoleClient();
  const { data: existing } = await db
    .from('property_finance_expenses')
    .select('*')
    .eq('id', id)
    .eq('property_id', propertyId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await db.from('property_finance_expenses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void writeAuditLog({
    userId: profile!.id, propertyId, action: 'delete',
    resourceType: 'property_finance_expense', resourceId: id,
    beforeState: expenseAuditSnapshot(existing as unknown as Record<string, unknown>),
  });
  return NextResponse.json({ ok: true });
}
