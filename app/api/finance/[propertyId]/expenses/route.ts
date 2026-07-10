import { writeAuditLog } from '@/lib/admin/audit';
import { requirePropertyAccess, requirePropertyWrite } from '@/src/shared/utils/route-auth';
import { expenseAuditSnapshot } from '@/lib/property-finance/audit-snapshots';
import { resolveExpensePaidSource } from '@/lib/property-finance/expense-paid-source';
import { toPeriodMonth } from '@/lib/property-finance/parse-airbnb-csv';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError } = await requirePropertyAccess(propertyId);
  if (authError) return authError;

  const url = new URL(req.url);
  const month = url.searchParams.get('month');
  const all = url.searchParams.get('all') === '1';

  const db = createServiceRoleClient();
  let query = db
    .from('property_finance_expenses')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });

  if (!all) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month=YYYY-MM required (or all=1)' }, { status: 400 });
    }
    let periodMonth: string;
    try { periodMonth = toPeriodMonth(month); }
    catch { return NextResponse.json({ error: 'Invalid month' }, { status: 400 }); }
    query = query.eq('period_month', periodMonth);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, ctx } = await requirePropertyWrite(propertyId);
  if (authError) return authError;

  const body = (await req.json()) as {
    month?: string;
    expense_type?: string;
    amount?: number;
    expense_date?: string | null;
    notes?: string | null;
    paid_from?: string | null;
    owner_id?: string | null;
  };

  const { month, expense_type, amount, expense_date, notes } = body;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month (YYYY-MM) required' }, { status: 400 });
  if (!expense_type?.trim()) return NextResponse.json({ error: 'expense_type required' }, { status: 400 });
  if (amount == null || Number.isNaN(Number(amount)) || Number(amount) < 0) return NextResponse.json({ error: 'amount must be non-negative' }, { status: 400 });

  const paidResolved = resolveExpensePaidSource({ paid_from: body.paid_from, owner_id: body.owner_id, defaultPaidFrom: 'self' });
  if (!paidResolved.ok) return NextResponse.json({ error: paidResolved.error }, { status: 400 });

  let periodMonth: string;
  try { periodMonth = toPeriodMonth(month); }
  catch { return NextResponse.json({ error: 'Invalid month' }, { status: 400 }); }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('property_finance_expenses')
    .insert({
      property_id: propertyId,
      period_month: periodMonth,
      expense_type: expense_type.trim(),
      amount: Number(amount),
      expense_date: expense_date || null,
      notes: notes?.trim() || null,
      paid_from: paidResolved.paid_from,
      owner_id: paidResolved.owner_id,
      created_by: ctx!.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void writeAuditLog({
    userId: ctx!.userId, propertyId, action: 'create',
    resourceType: 'property_finance_expense', resourceId: data.id,
    afterState: expenseAuditSnapshot(data as unknown as Record<string, unknown>),
  });

  return NextResponse.json({ expense: data });
}
