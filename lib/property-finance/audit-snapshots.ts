function normAuditScalar(v: unknown): unknown {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v;
}

function stableSnapshotJson(row: Record<string, unknown>): string {
  const sortedKeys = Object.keys(row).sort();
  const o: Record<string, unknown> = {};
  for (const k of sortedKeys) o[k] = normAuditScalar(row[k]);
  return JSON.stringify(o);
}

export function auditSnapshotsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return stableSnapshotJson(a) === stableSnapshotJson(b);
}

export function expenseAuditSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    property_id: row.property_id,
    period_month: row.period_month,
    expense_type: row.expense_type,
    amount: row.amount,
    expense_date: row.expense_date,
    notes: row.notes,
    paid_from: row.paid_from,
    owner_id: row.owner_id,
  };
}

export function directBookingAuditSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    property_id: row.property_id,
    period_month: row.period_month,
    guest_name: row.guest_name,
    amount: row.amount,
    guest_count: row.guest_count,
    guest_phone: row.guest_phone,
    received_date: row.received_date,
    check_in: row.check_in,
    check_out: row.check_out,
    nights: row.nights,
    notes: row.notes,
  };
}

export function airbnbRowAuditSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    property_id: row.property_id,
    period_month: row.period_month,
    row_type: row.row_type,
    guest: row.guest,
    confirmation_code: row.confirmation_code,
    start_date: row.start_date,
    end_date: row.end_date,
    guest_count: row.guest_count,
  };
}
