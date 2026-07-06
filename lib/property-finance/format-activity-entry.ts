import type { Json } from '@/types/database.types';

function ym(pm: unknown): string {
  if (typeof pm !== 'string') return '—';
  return pm.slice(0, 7);
}

function fmtCurrency(n: unknown): string {
  const x = Number(n);
  if (Number.isNaN(x)) return String(n ?? '');
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(x);
}

function isoDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function expenseIdentityLine(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const typ = String(after.expense_type ?? before.expense_type ?? 'Expense');
  const pm = after.period_month ?? before.period_month;
  const stmt = ym(pm);
  const dt = isoDate(after.expense_date ?? before.expense_date);
  return dt ? `${typ} · stmt ${stmt} · expense date ${dt}` : `${typ} · stmt ${stmt}`;
}

export function directBookingIdentityLine(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const g = String(after.guest_name ?? before.guest_name ?? 'Guest');
  const pm = ym(after.period_month ?? before.period_month);
  const ci = isoDate(after.check_in ?? before.check_in);
  return ci ? `${g} · check-in ${ci} · stmt ${pm}` : `${g} · stmt ${pm}`;
}

export function airbnbReservationIdentityLine(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const g = String(after.guest ?? before.guest ?? 'Reservation');
  const s = isoDate(after.start_date ?? before.start_date) ?? '—';
  const e = isoDate(after.end_date ?? before.end_date) ?? '—';
  const cc = after.confirmation_code ?? before.confirmation_code;
  return cc ? `${g} · stay ${s}–${e} · ${cc}` : `${g} · stay ${s}–${e}`;
}

const DELTA_LABELS: Record<string, Record<string, string>> = {
  property_finance_expense: {
    expense_type: 'Type',
    amount: 'Amount',
    expense_date: 'Date',
    notes: 'Notes',
    paid_from: 'Paid from',
    owner_id: 'OOP owner',
    period_month: 'Month',
  },
  property_finance_direct_booking: {
    guest_name: 'Guest',
    amount: 'Amount',
    guest_count: 'Guests',
    guest_phone: 'Phone',
    received_date: 'Paid date',
    check_in: 'Check-in',
    check_out: 'Check-out',
    nights: 'Nights',
    notes: 'Notes',
    period_month: 'Month',
  },
  property_finance_airbnb_row: {
    guest_count: 'Guests (manual)',
    guest: 'Guest',
    confirmation_code: 'Confirmation',
    start_date: 'Start',
    end_date: 'End',
    period_month: 'Month',
    row_type: 'Row type',
  },
};

function fmtDeltaValue(resourceType: string, key: string, v: unknown): string {
  if (v == null || v === '') return '—';
  if (key === 'amount') return `₹${fmtCurrency(v)}`;
  if (key === 'period_month' && typeof v === 'string') return ym(v);
  return String(v);
}

function deltaFieldEqual(key: string, bv: unknown, av: unknown): boolean {
  if (key === 'amount' || key === 'guest_count' || key === 'nights') {
    const nb = bv == null || bv === '' ? null : Number(bv);
    const na = av == null || av === '' ? null : Number(av);
    if (nb === na) return true;
    if (Number.isNaN(nb ?? NaN) && Number.isNaN(na ?? NaN)) return true;
    return false;
  }
  return JSON.stringify(bv) === JSON.stringify(av);
}

export function describePropertyChangeDelta(
  resourceType: string,
  before: Json | null,
  after: Json | null,
): string {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return '';
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const labels = DELTA_LABELS[resourceType] ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const parts: string[] = [];
  for (const key of keys) {
    if (key === 'id' || key === 'property_id') continue;
    const bv = b[key];
    const av = a[key];
    if (deltaFieldEqual(key, bv, av)) continue;
    const label = labels[key] ?? key;
    parts.push(`${label}: ${fmtDeltaValue(resourceType, key, bv)} → ${fmtDeltaValue(resourceType, key, av)}`);
  }
  return parts.join('; ');
}

function updateSubjectPrefix(resourceType: string, before: Record<string, unknown>, after: Record<string, unknown>): string {
  switch (resourceType) {
    case 'property_finance_expense': return expenseIdentityLine(before, after);
    case 'property_finance_direct_booking': return directBookingIdentityLine(before, after);
    case 'property_finance_airbnb_row': return airbnbReservationIdentityLine(before, after);
    default: return '';
  }
}

export function formatPropertyFinanceDisplayLine(args: {
  action: string;
  resource_type: string;
  before_state: Json | null;
  after_state: Json | null;
  userName: string;
}): string {
  const who = args.userName.trim() || 'Unknown';
  if (args.action === 'update' && args.before_state && args.after_state) {
    const b = args.before_state as Record<string, unknown>;
    const a = args.after_state as Record<string, unknown>;
    const delta = describePropertyChangeDelta(args.resource_type, args.before_state, args.after_state);
    const subject = updateSubjectPrefix(args.resource_type, b, a);
    if (delta && subject) return `${subject} — ${delta} · by ${who}`;
    if (delta) return `${delta} · by ${who}`;
  }
  const summary = formatPropertyFinanceActivitySummary({
    action: args.action,
    resource_type: args.resource_type,
    before_state: args.before_state,
    after_state: args.after_state,
  });
  return `${summary} · by ${who}`;
}

export function formatPropertyFinanceActivitySummary(args: {
  action: string;
  resource_type: string;
  before_state: Json | null;
  after_state: Json | null;
}): string {
  const { action, resource_type: rt } = args;
  const before = args.before_state && typeof args.before_state === 'object' ? (args.before_state as Record<string, unknown>) : null;
  const after = args.after_state && typeof args.after_state === 'object' ? (args.after_state as Record<string, unknown>) : null;

  if (rt === 'property_finance_expense') {
    const row = action === 'delete' ? before : after;
    if (!row) return 'Expense';
    const base = `${row.expense_type ?? 'Expense'} · ₹${fmtCurrency(row.amount)} · stmt ${ym(row.period_month)}`;
    const dt = isoDate(row.expense_date);
    return dt ? `${base} · expense date ${dt}` : base;
  }

  if (rt === 'property_finance_direct_booking') {
    const row = action === 'delete' ? before : after;
    if (!row) return 'Direct booking';
    const base = `${row.guest_name ?? 'Guest'} · ₹${fmtCurrency(row.amount)} · stmt ${ym(row.period_month)}`;
    const ci = isoDate(row.check_in);
    return ci ? `${base} · check-in ${ci}` : base;
  }

  if (rt === 'property_finance_airbnb_row') {
    const row = after ?? before;
    if (!row) return 'Airbnb row';
    const gc = row.guest_count != null ? `guests ${row.guest_count}` : 'guests from CSV';
    const g = String(row.guest ?? 'Reservation');
    const s = isoDate(row.start_date) ?? '—';
    const e = isoDate(row.end_date) ?? '—';
    return `${g} · stay ${s}–${e} · ${gc} · stmt ${ym(row.period_month)}`;
  }

  if (rt === 'property_finance_import') {
    const row = after;
    if (!row) return 'CSV import';
    const n = row.rows_imported ?? '?';
    const ok = row.headers_ok === false ? ' (header mismatch)' : '';
    return `Imported ${n} rows for ${ym(row.period_month)}${ok}`;
  }

  return action;
}

export function resourceLabel(resourceType: string): string {
  switch (resourceType) {
    case 'property_finance_expense': return 'Expense';
    case 'property_finance_direct_booking': return 'Direct booking';
    case 'property_finance_airbnb_row': return 'Airbnb reservation';
    case 'property_finance_import': return 'CSV import';
    default: return resourceType;
  }
}

export function actionLabel(action: string): string {
  switch (action) {
    case 'create': return 'Created';
    case 'update': return 'Updated';
    case 'delete': return 'Deleted';
    case 'import': return 'Imported';
    default: return action;
  }
}
