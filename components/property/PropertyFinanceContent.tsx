'use client';

import FinanceDashboard from '@/components/finance/FinanceDashboard';
import FinanceTabBar, { type FinanceTab } from '@/components/finance/FinanceTabBar';
import RevenueEngine from '@/components/finance/RevenueEngine';
import ExpenseEngine from '@/components/finance/ExpenseEngine';
import PlanningHub from '@/components/finance/PlanningHub';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Picker from '@/components/ui/Picker';
import { ResponsiveTable, TableCard } from '@/components/ui/ResponsiveTable';
import { formatExpensePaidLabel } from '@/lib/property-finance/expense-paid-source';
import { stripFinancialTrackerBackfillFromNote } from '@/lib/property-finance/strip-tracker-backfill-note';
import {
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  History,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  Phone,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  downloadMonthEndCsv,
  downloadMonthEndPdf,
  type MonthEndReportPayload,
} from '@/lib/property-finance/export-month-end';
import { sumDirectGuestCounts } from '@/lib/property-finance/guest-totals';

const EXPENSE_CATEGORIES: { label: string; items: string[] }[] = [
  {
    label: 'Utilities',
    items: ['Electricity', 'Water', 'WiFi & Internet', 'Gas & LPG', 'Cable & OTT'],
  },
  {
    label: 'Cleaning',
    items: ['Guest Turnover Clean', 'Deep Clean', 'Laundry & Linen', 'Housekeeping Supplies'],
  },
  {
    label: 'Maintenance',
    items: ['Lawn & Garden', 'Pest Control', 'Pool Maintenance', 'General Upkeep', 'Painting & Touch-up'],
  },
  {
    label: 'Repairs',
    items: ['Plumbing', 'Electrical Repair', 'AC & HVAC', 'Appliance Repair', 'Furniture Repair', 'Structural & Roof'],
  },
  {
    label: 'Supplies',
    items: ['Toiletries & Amenities', 'Kitchen Supplies', 'Bedding & Linen', 'Paper Products', 'Cleaning Products'],
  },
  {
    label: 'Staff & Labor',
    items: ['Caretaker & Watchman', 'Housekeeping Staff', 'Gardener', 'Cook', 'Part-time Help'],
  },
  {
    label: 'Guest Amenities',
    items: ['Welcome Kit', 'Breakfast & Provisions', 'Beverages', 'Activities & Experiences'],
  },
  {
    label: 'Marketing',
    items: ['Google & Meta Ads', 'Photography & Video', 'OTA Upgrades', 'Listing Fees'],
  },
  {
    label: 'Taxes & Compliance',
    items: ['Property Tax', 'Municipal Charges', 'Insurance', 'GST & Tax Filing', 'Professional Fees'],
  },
  {
    label: 'Capital Expenses',
    items: ['Furniture', 'Appliances & Electronics', 'AC Installation', 'Kitchen Equipment', 'Decor & Furnishings', 'Renovation'],
  },
  {
    label: 'Finance',
    items: ['Bank Charges', 'Loan Interest', 'Platform Fees (Airbnb)'],
  },
  {
    label: 'Other',
    items: ['Miscellaneous'],
  },
];

const PIE_COLORS = [
  'var(--accent)',
  'var(--color-blue)',
  'var(--color-gold)',
  'var(--tone-violet-tx)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
];

/** Tinted shells + value colors — uses CSS tokens so they adapt to light/dark */
const KPI_TONE_SHELL = {
  neutral: 'border-[var(--border-color)] bg-[var(--bg-surface)]',
  income:  'border-[var(--tone-income-bd)] bg-[var(--tone-income-bg)]',
  profit:  'border-[var(--tone-profit-bd)] bg-[var(--tone-profit-bg)]',
  emerald: 'border-[var(--tone-income-bd)] bg-[var(--tone-income-bg)]',
  sky:     'border-[var(--tone-profit-bd)] bg-[var(--tone-profit-bg)]',
  cyan:    'border-[var(--tone-profit-bd)] bg-[var(--tone-profit-bg)]',
  amber:   'border-[var(--tone-amber-bd)]  bg-[var(--tone-amber-bg)]',
  rose:    'border-[var(--tone-rose-bd)]   bg-[var(--tone-rose-bg)]',
  violet:  'border-[var(--tone-violet-bd)] bg-[var(--tone-violet-bg)]',
  orange:  'border-[var(--tone-amber-bd)]  bg-[var(--tone-amber-bg)]',
} as const;

const KPI_TONE_VALUE = {
  neutral: 'text-[var(--text-primary)]',
  income:  'text-[var(--tone-income-tx)]',
  profit:  'text-[var(--tone-profit-tx)]',
  emerald: 'text-[var(--tone-income-tx)]',
  sky:     'text-[var(--tone-profit-tx)]',
  cyan:    'text-[var(--tone-profit-tx)]',
  amber:   'text-[var(--tone-amber-tx)]',
  rose:    'text-[var(--tone-rose-tx)]',
  violet:  'text-[var(--tone-violet-tx)]',
  orange:  'text-[var(--tone-amber-tx)]',
} as const;

type KpiTone = keyof typeof KPI_TONE_SHELL;

type SummaryJson = {
  month: string;
  aggregates: {
    bankPayouts: number;
    taxWithholding: number;
    daysBooked: number;
    daysBookedDirect: number;
    daysBookedAirbnb: number;
    directBookingCount: number;
    reservationCount: number;
    reservationHostAmount: number;
    serviceFeeSum: number;
    grossBookingSum: number;
    expenseTotal: number;
    directTotal: number;
    cashInboundEstimate: number;
    netCash: number;
    expenseByCategory: Record<string, number>;
    totalBookingCount: number;
    averageCostPerBooking: number | null;
    averageGuestChargePerNight: number | null;
    guestsMonthTotal: number;
    guestsMonthAirbnb: number;
    guestsMonthDirect: number;
    guestsAllTimeTotal: number;
    guestsAllTimeAirbnb: number;
    guestsAllTimeDirect: number;
  };
  insights: string[];
  trend: { month: string; netCash: number; expenses: number; airbnbBank: number; direct: number }[];
  expenses: Array<{
    id: string;
    expense_type: string;
    amount: number;
    expense_date: string | null;
    notes: string | null;
    paid_from?: string | null;
    owner_id?: string | null;
    created_at: string;
  }>;
  directBookings: Array<{
    id: string;
    guest_name: string;
    amount: number;
    guest_count: number | null;
    guest_phone: string | null;
    received_date: string | null;
    check_in: string | null;
    check_out: string | null;
    nights: number | null;
    notes: string | null;
    created_at: string;
    period_month?: string;
  }>;
  reservationPreview: Array<{
    id: string;
    guest: string | null;
    start_date: string | null;
    end_date: string | null;
    nights: number | null;
    gross_earnings: number | null;
    amount: number | null;
    paid_out: number | null;
    service_fee: number | null;
    guest_count: number | null;
    guests_inferred: number;
    guests_effective: number;
  }>;
  airbnbRowCount: number;
  outOfPocketByOwner: Record<string, number>;
};

type AllMonthsSummaryResponse = {
  months: Array<{
    month: string;
    periodMonth: string;
    expenseTotal: number;
    directTotal: number;
    bankPayouts: number;
    taxWithholding: number;
    grossBookingSum: number;
    serviceFeeSum: number;
    reservationCount: number;
    cashInboundEstimate: number;
    netCash: number;
    outOfPocketTeja: number;
    outOfPocketIndu: number;
  }>;
  grandTotals: {
    expenseTotal: number;
    directTotal: number;
    bankPayouts: number;
    taxWithholding: number;
    grossBookingSum: number;
    serviceFeeSum: number;
    cashInboundEstimate: number;
    netCash: number;
    outOfPocketByPayer: { teja: number; indu: number };
  };
  monthCount: number;
};

function currentYm(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function parseYm(ym: string): Date {
  const [ys, ms] = ym.split('-');
  const y = Number(ys);
  const mo = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return new Date();
  return new Date(y, mo - 1, 1);
}

function addMonthsToYm(ym: string, delta: number): string {
  const d = parseYm(ym);
  d.setMonth(d.getMonth() + delta);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function formatStatementMonthLabel(ym: string): string {
  const d = parseYm(ym);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(d);
}

function formatInr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function parseExpenseType(v: string): { cat: string; sub: string; custom: string } {
  if (!v) return { cat: '', sub: '', custom: '' };
  const sep = v.indexOf(' / ');
  if (sep > 0) {
    const cat = v.slice(0, sep);
    const sub = v.slice(sep + 3);
    const catDef = EXPENSE_CATEGORIES.find((c) => c.label === cat);
    if (catDef) {
      const known = catDef.items.includes(sub);
      return { cat, sub: known ? sub : '__custom__', custom: known ? '' : sub };
    }
  }
  for (const catDef of EXPENSE_CATEGORIES) {
    if (catDef.items.includes(v)) return { cat: catDef.label, sub: v, custom: '' };
  }
  return { cat: '', sub: v ? '__custom__' : '', custom: v };
}

function ExpenseCategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const init = parseExpenseType(value);
  const [cat, setCat] = useState(init.cat);
  const [sub, setSub] = useState(init.sub);
  const [custom, setCustom] = useState(init.custom);

  const catDef = EXPENSE_CATEGORIES.find((c) => c.label === cat);

  function emit(c: string, s: string, cu: string) {
    const subVal = s === '__custom__' ? cu.trim() : s;
    if (!c || !subVal) return;
    onChange(`${c} / ${subVal}`);
  }

  function onCatChange(c: string) {
    setCat(c);
    setSub('');
    setCustom('');
  }

  function onSubChange(s: string) {
    setSub(s);
    if (s && s !== '__custom__') emit(cat, s, '');
  }

  function onCustomChange(cu: string) {
    setCustom(cu);
    emit(cat, '__custom__', cu);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
          Category
          <Picker
            value={cat}
            onChange={onCatChange}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c.label, label: c.label }))}
            placeholder="Select…"
            className="w-full"
            searchable
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
          Subcategory
          <Picker
            value={sub}
            onChange={onSubChange}
            options={[
              ...(catDef?.items.map((item) => ({ value: item, label: item })) ?? []),
              { value: '__custom__', label: 'Custom…' },
            ]}
            placeholder="Select…"
            disabled={!cat}
            className="w-full"
          />
        </label>
      </div>
      {sub === '__custom__' && (
        <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
          Custom type
          <input
            required
            value={custom}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="e.g. Solar panel maintenance"
            className="min-h-11 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
          />
        </label>
      )}
    </div>
  );
}

type DirectBooking = SummaryJson['directBookings'][number];
type Reservation = SummaryJson['reservationPreview'][number];

function BookingsTab({
  directBookings,
  reservations,
  loading,
  isReadOnly,
  onEditDirect,
  onDeleteDirect,
  onEditAirbnbGuest,
  formatInr,
}: {
  directBookings: DirectBooking[];
  reservations: Reservation[];
  loading: boolean;
  isReadOnly: boolean;
  onEditDirect: (r: DirectBooking) => void;
  onDeleteDirect: (id: string) => void;
  onEditAirbnbGuest: (r: Reservation) => void;
  formatInr: (n: number) => string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Direct Bookings */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Direct Bookings</h2>
          <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
            {directBookings.length}
          </span>
        </div>
        {directBookings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">No direct bookings this month.</p>
        ) : (
          <ResponsiveTable
            table={
              <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
                <table className="w-full min-w-[40rem] text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-tertiary)] border-b border-[var(--border-color)] bg-[var(--bg-elevated)]">
                      <th className="px-4 py-2.5 font-medium">Guest</th>
                      <th className="px-4 py-2.5 font-medium">Phone</th>
                      <th className="px-4 py-2.5 font-medium">Guests</th>
                      <th className="px-4 py-2.5 font-medium">Amount</th>
                      <th className="px-4 py-2.5 font-medium">Stay</th>
                      <th className="px-4 py-2.5 font-medium">Notes</th>
                      {!isReadOnly && <th className="px-4 py-2.5 w-20 text-right font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {directBookings.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--border-color)]/60 hover:bg-[var(--bg-elevated)]/30">
                        <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{r.guest_name}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                          {r.guest_phone ? (
                            <a href={`tel:${r.guest_phone.replace(/\s/g, '')}`} className="text-[var(--accent)] hover:underline">
                              {r.guest_phone}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{r.guest_count ?? '—'}</td>
                        <td className="px-4 py-2.5 font-medium text-[var(--accent)]">{formatInr(Number(r.amount))}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">
                          {r.check_in && r.check_out ? `${r.check_in} → ${r.check_out}` : '—'}
                          {r.nights != null ? ` (${r.nights}n)` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)] max-w-[10rem] truncate">{r.notes ?? '—'}</td>
                        {!isReadOnly && (
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={() => onEditDirect(r)}
                                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-raised)] hover:text-[var(--accent)]">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => onDeleteDirect(r.id)}
                                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
            cards={
              <div className="p-3 space-y-3">
                {directBookings.map((r) => (
                  <TableCard
                    key={r.id}
                    title={<span className="font-medium text-sm text-[var(--text-primary)]">{r.guest_name}</span>}
                    titleExtra={<span className="font-medium text-sm text-[var(--accent)]">{formatInr(Number(r.amount))}</span>}
                    fields={[
                      {
                        label: 'Phone',
                        value: r.guest_phone ? (
                          <a href={`tel:${r.guest_phone.replace(/\s/g, '')}`} className="text-[var(--accent)]">{r.guest_phone}</a>
                        ) : '—',
                      },
                      { label: 'Guests', value: r.guest_count ?? '—' },
                      {
                        label: 'Stay',
                        value: r.check_in && r.check_out
                          ? `${r.check_in} → ${r.check_out}${r.nights != null ? ` (${r.nights}n)` : ''}`
                          : '—',
                      },
                      { label: 'Notes', value: r.notes ?? '—' },
                    ]}
                    actions={!isReadOnly ? (
                      <>
                        <button type="button" onClick={() => onEditDirect(r)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent)]">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button type="button" onClick={() => onDeleteDirect(r.id)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 ml-auto">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </>
                    ) : undefined}
                  />
                ))}
              </div>
            }
          />
        )}
      </Card>

      {/* Airbnb Reservations */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[var(--border-color)] flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Airbnb Reservations</h2>
          <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
            {reservations.length}
          </span>
        </div>
        {reservations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">No Airbnb reservations this month.</p>
        ) : (
          <ResponsiveTable
            table={
              <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
                <table className="w-full min-w-[40rem] text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-tertiary)] border-b border-[var(--border-color)] bg-[var(--bg-elevated)]">
                      <th className="px-4 py-2.5 font-medium">Guest</th>
                      <th className="px-4 py-2.5 font-medium">Stay</th>
                      <th className="px-4 py-2.5 font-medium">Guests</th>
                      <th className="px-4 py-2.5 font-medium">Gross</th>
                      <th className="px-4 py-2.5 font-medium">Payout</th>
                      <th className="px-4 py-2.5 font-medium">Fee</th>
                      {!isReadOnly && <th className="px-4 py-2.5 w-16 text-right font-medium">Edit</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--border-color)]/60 hover:bg-[var(--bg-elevated)]/30">
                        <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{r.guest ?? '—'}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">
                          {r.start_date ?? '—'} → {r.end_date ?? '—'}
                          {r.nights != null ? ` (${r.nights}n)` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                          {r.guests_effective}
                          {r.guest_count != null && (
                            <span className="ml-1 text-[10px] uppercase tracking-wide text-[var(--accent)]">saved</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                          {r.gross_earnings != null ? formatInr(Number(r.gross_earnings)) : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-[var(--accent)]">
                          {r.amount != null ? formatInr(Number(r.amount)) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                          {r.service_fee != null ? formatInr(Number(r.service_fee)) : '—'}
                        </td>
                        {!isReadOnly && (
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end">
                              <button type="button" onClick={() => onEditAirbnbGuest(r)}
                                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-raised)] hover:text-[var(--accent)]"
                                aria-label="Edit guest count">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
            cards={
              <div className="p-3 space-y-3">
                {reservations.map((r) => (
                  <TableCard
                    key={r.id}
                    title={<span className="font-medium text-sm text-[var(--text-primary)]">{r.guest ?? '—'}</span>}
                    titleExtra={
                      <span className="font-medium text-sm text-[var(--accent)]">
                        {r.amount != null ? formatInr(Number(r.amount)) : '—'}
                      </span>
                    }
                    fields={[
                      {
                        label: 'Stay',
                        value: `${r.start_date ?? '—'} → ${r.end_date ?? '—'}${r.nights != null ? ` (${r.nights}n)` : ''}`,
                      },
                      {
                        label: 'Guests',
                        value: (
                          <>
                            {r.guests_effective}
                            {r.guest_count != null && (
                              <span className="ml-1 text-[10px] uppercase tracking-wide text-[var(--accent)]">saved</span>
                            )}
                          </>
                        ),
                      },
                      { label: 'Gross', value: r.gross_earnings != null ? formatInr(Number(r.gross_earnings)) : '—' },
                      { label: 'Fee', value: r.service_fee != null ? formatInr(Number(r.service_fee)) : '—' },
                    ]}
                    actions={!isReadOnly ? (
                      <button type="button" onClick={() => onEditAirbnbGuest(r)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent)]"
                        aria-label="Edit guest count">
                        <Pencil className="w-3 h-3" /> Edit guests
                      </button>
                    ) : undefined}
                  />
                ))}
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}

export default function PropertyFinanceContent({ propertyId, propertyName = "Property", isReadOnly = false }: { propertyId: string; propertyName?: string; isReadOnly?: boolean }) {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [month, setMonth] = useState(currentYm);
  const [data, setData] = useState<SummaryJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const [expenseType, setExpenseType] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expensePaidFrom, setExpensePaidFrom] = useState<'self' | 'out_of_pocket'>('self');
  const [expensePocketBy, setExpensePocketBy] = useState<string | null>(null);
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch(`/api/properties/${propertyId}/owners`)
      .then(r => r.json())
      .then(d => setOwners(d.owners ?? []))
      .catch(() => {});
  }, [propertyId]);
  const [expenseSaving, setExpenseSaving] = useState(false);

  const [expenseEditDraft, setExpenseEditDraft] = useState<{
    id: string;
    expense_type: string;
    amount: string;
    expense_date: string;
    notes: string;
    paid_from: 'self' | 'out_of_pocket';
    owner_id: string | null;
  } | null>(null);
  const [expenseEditSaving, setExpenseEditSaving] = useState(false);

  const [directEditDraft, setDirectEditDraft] = useState<{
    id: string;
    guest_name: string;
    amount: string;
    guest_count: string;
    guest_phone: string;
    check_in: string;
    check_out: string;
    nights: string;
    notes: string;
  } | null>(null);
  const [directEditSaving, setDirectEditSaving] = useState(false);

  const [airbnbGuestEdit, setAirbnbGuestEdit] = useState<{
    id: string;
    guest_label: string;
    guests_inferred: number;
    guest_count_input: string;
  } | null>(null);
  const [airbnbGuestEditSaving, setAirbnbGuestEditSaving] = useState(false);

  const [dguest, setDguest] = useState('');
  const [dguestCount, setDguestCount] = useState('');
  const [damount, setDamount] = useState('');
  const [dreceived, setDreceived] = useState('');
  const [dnights, setDnights] = useState('');
  const [dcheckIn, setDcheckIn] = useState('');
  const [dcheckOut, setDcheckOut] = useState('');
  const [dphone, setDphone] = useState('');
  const [dnotes, setDnotes] = useState('');
  const [dsaving, setDsaving] = useState(false);

  const [upcoming, setUpcoming] = useState<SummaryJson['directBookings']>([]);
  const [allMonthsOpen, setAllMonthsOpen] = useState(false);
  const [allMonthsLoading, setAllMonthsLoading] = useState(false);
  const [allMonthsData, setAllMonthsData] = useState<AllMonthsSummaryResponse | null>(null);
  const [allMonthsError, setAllMonthsError] = useState<string | null>(null);

  const csvImportRef = useRef<HTMLInputElement>(null);

  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addDirectOpen, setAddDirectOpen] = useState(false);

  const [oopListOpen, setOopListOpen] = useState(false);
  const [oopListPayer, setOopListPayer] = useState<string | null>(null);
  const [oopListLoading, setOopListLoading] = useState(false);
  const [oopListError, setOopListError] = useState<string | null>(null);
  const [oopListRows, setOopListRows] = useState<
    Array<{
      id: string;
      period_month: string;
      expense_type: string;
      amount: number;
      expense_date: string | null;
      notes: string | null;
      created_at: string;
    }>
  >([]);

  const [activityOpen, setActivityOpen] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityEntries, setActivityEntries] = useState<
    Array<{
      id: string;
      created_at: string;
      action_label: string;
      resource_label: string;
      display_line: string;
    }>
  >([]);
  const refreshUpcoming = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance/${propertyId}/direct-bookings/upcoming`);
      const json = await res.json();
      if (res.ok) setUpcoming(json.upcoming ?? []);
      else setUpcoming([]);
    } catch {
      setUpcoming([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/${propertyId}/summary?month=${month}&trendMonths=9`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      const normalized = {
        ...json,
        outOfPocketByOwner: json.outOfPocketByOwner ?? {},
      };
      setData(normalized as SummaryJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
      await refreshUpcoming();
    }
  }, [month, refreshUpcoming]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    refreshUpcoming();
  }, [refreshUpcoming]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  const openAllMonthsSummary = async () => {
    setAllMonthsOpen(true);
    setAllMonthsLoading(true);
    setAllMonthsData(null);
    setAllMonthsError(null);
    try {
      const res = await fetch('/api/finance/${propertyId}/summary-all');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load summary');
      setAllMonthsData(json as AllMonthsSummaryResponse);
    } catch (e) {
      setAllMonthsError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setAllMonthsLoading(false);
    }
  };

  const pieData = useMemo(() => {
    const cat = data?.aggregates.expenseByCategory ?? {};
    return Object.entries(cat).map(([name, value]) => ({ name, value }));
  }, [data]);

  const upcomingGuestsTotal = useMemo(
    () => sumDirectGuestCounts(upcoming.map((r) => ({ guest_count: r.guest_count }))),
    [upcoming],
  );

  const onAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseType) { setError('Category is required'); return; }
    setExpenseSaving(true);
    try {
      const res = await fetch(`/api/finance/${propertyId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          expense_type: expenseType,
          amount: Number.parseFloat(expenseAmount),
          expense_date: expenseDate || null,
          notes: expenseNotes || null,
          paid_from: expensePaidFrom,
          owner_id: expensePaidFrom === 'out_of_pocket' ? expensePocketBy : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setExpenseType('');
      setExpenseAmount('');
      setExpenseDate('');
      setExpenseNotes('');
      setExpensePaidFrom('self');
      setExpensePocketBy('teja');
      setAddExpenseOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setExpenseSaving(false);
    }
  };

  const onAddDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setDsaving(true);
    try {
      const res = await fetch('/api/finance/${propertyId}/direct-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          guest_name: dguest,
          amount: Number.parseFloat(damount),
          guest_count: (() => {
            const t = dguestCount.trim();
            if (!t) return null;
            const n = Number.parseInt(t, 10);
            return Number.isFinite(n) && n >= 1 ? n : null;
          })(),
          guest_phone: dphone.trim() || null,
          received_date: dreceived || null,
          nights: dnights ? Number.parseInt(dnights, 10) : null,
          check_in: dcheckIn || null,
          check_out: dcheckOut || null,
          notes: dnotes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setDguest('');
      setDguestCount('');
      setDamount('');
      setDphone('');
      setDreceived('');
      setDnights('');
      setDcheckIn('');
      setDcheckOut('');
      setDnotes('');
      setAddDirectOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setDsaving(false);
    }
  };

  const openExpenseEdit = (r: SummaryJson['expenses'][number]) => {
    const pf = r.paid_from === 'out_of_pocket' ? 'out_of_pocket' : 'self';
    setExpenseEditDraft({
      id: r.id,
      expense_type: r.expense_type,
      amount: String(r.amount),
      expense_date: r.expense_date ?? '',
      notes: stripFinancialTrackerBackfillFromNote(r.notes) ?? '',
      paid_from: pf,
      owner_id: r.owner_id ?? null,
    });
  };

  const openDirectEdit = (r: SummaryJson['directBookings'][number]) => {
    setDirectEditDraft({
      id: r.id,
      guest_name: r.guest_name,
      amount: String(r.amount),
      guest_count: r.guest_count != null ? String(r.guest_count) : '',
      guest_phone: r.guest_phone ?? '',
      check_in: r.check_in ?? '',
      check_out: r.check_out ?? '',
      nights: r.nights != null ? String(r.nights) : '',
      notes: stripFinancialTrackerBackfillFromNote(r.notes) ?? '',
    });
  };

  const openAirbnbGuestEdit = (r: SummaryJson['reservationPreview'][number]) => {
    setAirbnbGuestEdit({
      id: r.id,
      guest_label: r.guest?.trim() || 'Reservation',
      guests_inferred: r.guests_inferred,
      guest_count_input: r.guest_count != null ? String(r.guest_count) : '',
    });
  };

  const onSaveAirbnbGuestEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!airbnbGuestEdit) return;
    setAirbnbGuestEditSaving(true);
    setError(null);
    try {
      const t = airbnbGuestEdit.guest_count_input.trim();
      let guest_count: number | null;
      if (t === '') {
        guest_count = null;
      } else {
        const n = Math.floor(Number.parseInt(t, 10));
        if (Number.isNaN(n) || n < 1 || n > 99) {
          setError('Guest count must be between 1 and 99, or leave blank to use the CSV default (usually 1).');
          setAirbnbGuestEditSaving(false);
          return;
        }
        guest_count = n;
      }
      const res = await fetch(`/api/finance/${propertyId}/airbnb-rows/${airbnbGuestEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_count }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      setAirbnbGuestEdit(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setAirbnbGuestEditSaving(false);
    }
  };

  const onSaveDirectEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEditDraft) return;
    setDirectEditSaving(true);
    setError(null);
    try {
      const gcRaw = directEditDraft.guest_count.trim();
      let guest_count: number | null;
      if (gcRaw === '') {
        guest_count = null;
      } else {
        const n = Math.floor(Number.parseInt(gcRaw, 10));
        if (Number.isNaN(n) || n < 1) {
          setError('Guest count must be a positive integer, or leave blank to use default (1) in totals.');
          setDirectEditSaving(false);
          return;
        }
        guest_count = n;
      }
      const guestName = directEditDraft.guest_name.trim();
      if (!guestName) {
        setError('Guest name is required.');
        setDirectEditSaving(false);
        return;
      }
      const amt = Number.parseFloat(directEditDraft.amount);
      if (Number.isNaN(amt) || amt < 0) {
        setError('Amount must be a non-negative number.');
        setDirectEditSaving(false);
        return;
      }
      const nightsRaw = directEditDraft.nights.trim();
      let nights: number | null;
      if (nightsRaw === '') {
        nights = null;
      } else {
        const n = Math.floor(Number.parseInt(nightsRaw, 10));
        if (Number.isNaN(n) || n < 0) {
          setError('Nights must be a non-negative integer, or leave blank.');
          setDirectEditSaving(false);
          return;
        }
        nights = n;
      }
      const res = await fetch(`/api/finance/${propertyId}/direct-bookings/${directEditDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName,
          guest_count,
          amount: amt,
          guest_phone: directEditDraft.guest_phone.trim() || null,
          check_in: directEditDraft.check_in || null,
          check_out: directEditDraft.check_out || null,
          nights,
          notes: directEditDraft.notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      setDirectEditDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setDirectEditSaving(false);
    }
  };

  const onSaveExpenseEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseEditDraft) return;
    if (!expenseEditDraft.expense_type) { setError('Category is required'); return; }
    setExpenseEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/${propertyId}/expenses/${expenseEditDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_type: expenseEditDraft.expense_type,
          amount: Number.parseFloat(expenseEditDraft.amount),
          expense_date: expenseEditDraft.expense_date || null,
          notes: expenseEditDraft.notes.trim() || null,
          paid_from: expenseEditDraft.paid_from,
          owner_id:
            expenseEditDraft.paid_from === 'out_of_pocket' ? expenseEditDraft.owner_id : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      setExpenseEditDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setExpenseEditSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    const res = await fetch(`/api/finance/${propertyId}/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error || 'Delete failed');
      return;
    }
    await load();
  };

  const deleteDirect = async (id: string) => {
    if (!confirm('Delete this direct booking?')) return;
    const res = await fetch(`/api/finance/${propertyId}/direct-bookings/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error || 'Delete failed');
      return;
    }
    await load();
  };

  const onCsvImport = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('month', month);
      const res = await fetch(`/api/finance/${propertyId}/import`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import failed');
      setImportMsg(
        `Imported ${json.imported} rows.${json.warning ? ` ${json.warning}` : ''}${json.headersOk === false ? ' (header mismatch — verify columns)' : ''}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const agg = data?.aggregates;

  const buildExportPayload = (): MonthEndReportPayload | null => {
    if (!data) return null;
    return {
      month: data.month,
      aggregates: data.aggregates,
      insights: data.insights,
      expenses: data.expenses.map((e) => ({
        expense_type: e.expense_type,
        amount: Number(e.amount),
        expense_date: e.expense_date,
        notes: e.notes,
        paid_from: e.paid_from,
        owner_id: e.owner_id,
      })),
      directBookings: data.directBookings.map((d) => ({
        guest_name: d.guest_name,
        amount: Number(d.amount),
        guest_count: d.guest_count ?? null,
        guest_phone: d.guest_phone ?? null,
        received_date: d.received_date,
        check_in: d.check_in,
        check_out: d.check_out,
        nights: d.nights,
        notes: d.notes,
      })),
      reservationPreview: data.reservationPreview,
      airbnbRowCount: data.airbnbRowCount,
      outOfPocketByOwner: data.outOfPocketByOwner ?? {},
      ownerNames: Object.fromEntries(owners.map((o) => [o.id, o.name])),
    };
  };

  const handleExportCsv = () => {
    const p = buildExportPayload();
    if (!p) return;
    downloadMonthEndCsv(p);
  };

  const handleExportPdf = () => {
    const p = buildExportPayload();
    if (!p) return;
    downloadMonthEndPdf(p);
  };

  const openOopExpenseList = useCallback(async (ownerId: string) => {
    setOopListPayer(ownerId);
    setOopListOpen(true);
    setOopListLoading(true);
    setOopListError(null);
    setOopListRows([]);
    try {
      const res = await fetch(`/api/finance/${propertyId}/expenses/out-of-pocket?owner_id=${ownerId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load expenses');
      setOopListRows(json.expenses ?? []);
    } catch (e) {
      setOopListError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setOopListLoading(false);
    }
  }, []);

  function ymFromPeriodMonth(iso: string): string {
    return iso.slice(0, 7);
  }

  const openActivityLog = useCallback(async () => {
    setActivityOpen(true);
    setActivityLoading(true);
    setActivityError(null);
    setActivityEntries([]);
    try {
      const res = await fetch('/api/finance/${propertyId}/activity');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load activity');
      setActivityEntries(json.entries ?? []);
    } catch (e) {
      setActivityError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setActivityLoading(false);
    }
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-5 pb-8 sm:px-6 sm:py-6 sm:pb-10 space-y-6 sm:space-y-8">
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="shrink-0">
          <h1
            className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-fraunces)' }}
          >
            {propertyName} P&L
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed max-w-xs hidden sm:block">
            Monthly P&L dashboard for {propertyName}.
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-stretch gap-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-0.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth((m) => addMonthsToYm(m, -1))}
                className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:bg-[var(--bg-surface)]"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <label className="relative flex min-h-9 min-w-[10.5rem] cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]/70 sm:min-w-[11rem]">
                <Calendar className="pointer-events-none h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
                <span className="pointer-events-none text-sm font-medium tabular-nums tracking-tight">
                  {formatStatementMonthLabel(month)}
                </span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Statement month"
                />
              </label>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonth((m) => addMonthsToYm(m, 1))}
                className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:bg-[var(--bg-surface)]"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <button
              type="button"
              onClick={openAllMonthsSummary}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/25"
            >
              <LayoutList className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">All months</span>
            </button>
            <button
              type="button"
              onClick={openActivityLog}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-raised)]"
            >
              <History className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
              <span className="whitespace-nowrap">Activity log</span>
            </button>
          </div>
          <input
            ref={csvImportRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={importing}
            onChange={onCsvImport}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" disabled={loading || !data} onClick={handleExportCsv}>
              <Download className="h-4 w-4 shrink-0" />
              <span>CSV</span>
            </Button>
            <Button variant="secondary" disabled={loading || !data} onClick={handleExportPdf}>
              <FileDown className="h-4 w-4 shrink-0" />
              <span>PDF report</span>
            </Button>
          </div>
          {importMsg && (
            <p className="text-xs text-emerald-400">{importMsg}</p>
          )}

        </div>
      </div>

      <FinanceTabBar active={activeTab} onChange={setActiveTab} isReadOnly={isReadOnly} />

      {!isReadOnly && activeTab === 'expenses' && (
        <div className="flex justify-end pt-3">
          <Button disabled={loading || !data} onClick={() => setAddExpenseOpen(true)}>
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add expense</span>
          </Button>
        </div>
      )}

      {!isReadOnly && activeTab === 'bookings' && (
        <div className="flex flex-wrap justify-end gap-2 pt-3">
          <Button variant="secondary" disabled={importing} onClick={() => csvImportRef.current?.click()}>
            {importing ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Upload className="h-4 w-4 shrink-0" />}
            <span className="truncate">{importing ? 'Importing…' : 'Import Airbnb CSV'}</span>
          </Button>
          <Button disabled={loading || !data} onClick={() => setAddDirectOpen(true)}>
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add direct booking</span>
          </Button>
        </div>
      )}

      {activeTab === 'revenue' && <RevenueEngine month={month} propertyId={propertyId} isReadOnly={isReadOnly} />}
      {activeTab === 'expenses' && <ExpenseEngine month={month} propertyId={propertyId} />}
      {activeTab === 'bookings' && (
        <BookingsTab
          directBookings={data?.directBookings ?? []}
          reservations={data?.reservationPreview ?? []}
          loading={loading}
          isReadOnly={isReadOnly}
          onEditDirect={openDirectEdit}
          onDeleteDirect={deleteDirect}
          onEditAirbnbGuest={openAirbnbGuestEdit}
          formatInr={formatInr}
        />
      )}
      {activeTab === 'planning' && !isReadOnly && <PlanningHub propertyId={propertyId} />}

      {activeTab === 'overview' && (
        <>
          <FinanceDashboard month={month} propertyId={propertyId} />

          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--accent)]/45 bg-[var(--accent)]/[0.09] px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            title="Direct stays with a check-in date: future check-ins or in-stay today. Guest total = party size per booking (blank counts as 1)."
          >
        <div className="flex flex-wrap items-center gap-x-2 shrink-0">
          <CalendarClock className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
          <span className="min-w-0 tabular-nums text-[var(--text-primary)]">
            <span className="font-semibold text-[var(--accent)]">{upcomingGuestsTotal}</span> upcoming guest
            {upcomingGuestsTotal === 1 ? '' : 's'} · {upcoming.length} stay{upcoming.length === 1 ? '' : 's'}
            <span className="font-normal text-[var(--text-tertiary)]"> · direct</span>
          </span>
        </div>
        {upcoming.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-l border-[var(--border-color)]/50 pl-3 text-xs sm:text-sm">
            {upcoming.map((r, i) => (
              <span key={r.id} className="inline-flex flex-wrap items-center gap-x-1.5">
                {i > 0 ? (
                  <span className="text-[var(--text-tertiary)]/70 select-none px-0.5" aria-hidden>
                    |
                  </span>
                ) : null}
                <span className="font-medium text-violet-200">{r.guest_name}</span>
                <span className="text-[var(--text-tertiary)]">·</span>
                {r.guest_phone ? (
                  <a
                    href={`tel:${r.guest_phone.replace(/\s/g, '')}`}
                    className="text-sky-400 hover:text-sky-300 hover:underline tabular-nums"
                  >
                    {r.guest_phone}
                  </a>
                ) : (
                  <span className="text-[var(--text-tertiary)]">—</span>
                )}
                <span className="text-[var(--text-tertiary)]">·</span>
                <span className="tabular-nums text-amber-200/95" title="Check-in">
                  {r.check_in ?? '—'}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="border-l border-[var(--border-color)]/50 pl-3 text-xs text-[var(--text-tertiary)]">
            No upcoming direct stays — add a check-in on a direct booking.
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-3 sm:px-4 text-sm text-red-200 break-words">
          {error}
        </div>
      )}

      {data && data.aggregates.bankPayouts === 0 && data.aggregates.reservationCount > 0 && (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-3 sm:px-4 text-sm text-amber-100/95 leading-relaxed">
          <strong className="text-amber-50">Airbnb bank payouts are ₹0</strong> until you import Airbnb&apos;s official{' '}
          <em>transaction / payout</em> CSV for this month (that file includes <strong>Payout</strong> rows). Reservation
          gross and fees below can come from that import or from the financial tracker backfill script.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {/* Top: 4-col KPI row. Below: activity (2 cols) + stacked revenue/fees/OOP (2 cols) so no dead space beside tall activity */}
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-4 lg:items-stretch lg:gap-x-3 lg:gap-y-2.5">
            <Kpi
              compact
              tone="income"
              label="Cash in (est.)"
              value={formatInr(agg?.cashInboundEstimate ?? 0)}
              hint="Payout + withholding + direct"
            />
            <Kpi
              compact
              tone="profit"
              label="Net after expenses"
              value={formatInr(agg?.netCash ?? 0)}
              hint="Cash in − expenses"
            />
            <Kpi
              compact
              tone="amber"
              label="Total expenses"
              value={formatInr(agg?.expenseTotal ?? 0)}
              hint="Logged bills & purchases"
            />
            <Kpi
              compact
              tone="rose"
              label="Avg cost / booking"
              value={agg?.averageCostPerBooking != null ? formatInr(agg.averageCostPerBooking) : '—'}
              hint={
                (agg?.totalBookingCount ?? 0) > 0
                  ? `Expenses ÷ ${agg?.totalBookingCount ?? 0} stays`
                  : 'No stays this month'
              }
            />

            <div className="flex min-h-0 min-w-0 flex-col lg:col-span-2 lg:h-full">
              <ActivityKpi
                bookingAirbnb={agg?.reservationCount ?? 0}
                bookingDirect={agg?.directBookingCount ?? 0}
                nightsAirbnb={agg?.daysBookedAirbnb ?? 0}
                nightsDirect={agg?.daysBookedDirect ?? 0}
                guestsMonthTotal={agg?.guestsMonthTotal ?? 0}
                guestsMonthAirbnb={agg?.guestsMonthAirbnb ?? 0}
                guestsMonthDirect={agg?.guestsMonthDirect ?? 0}
                guestsAllTimeTotal={agg?.guestsAllTimeTotal ?? 0}
                guestsAllTimeAirbnb={agg?.guestsAllTimeAirbnb ?? 0}
                guestsAllTimeDirect={agg?.guestsAllTimeDirect ?? 0}
              />
            </div>

            <div className="flex min-h-0 min-w-0 flex-col gap-1.5 lg:col-span-2 lg:h-full lg:gap-2">
              <div className="grid grid-cols-2 gap-1.5 lg:gap-2">
                <Kpi
                  compact
                  dense
                  tone="sky"
                  label="Airbnb bank payouts"
                  value={formatInr(agg?.bankPayouts ?? 0)}
                  hint="Paid out (import)"
                />
                <Kpi
                  compact
                  dense
                  tone="cyan"
                  label="Direct revenue"
                  value={formatInr(agg?.directTotal ?? 0)}
                  hint="Off-platform cash"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5 lg:gap-2">
                <Kpi
                  compact
                  dense
                  tone="violet"
                  label="Avg guest charge / night"
                  value={
                    agg?.averageGuestChargePerNight != null
                      ? formatInr(agg.averageGuestChargePerNight)
                      : '—'
                  }
                  hint={
                    (agg?.daysBooked ?? 0) > 0
                      ? '(Airbnb gross + direct) ÷ nights booked'
                      : 'No nights booked this month'
                  }
                />
                <Kpi
                  compact
                  dense
                  tone="orange"
                  label="Airbnb service fees"
                  value={formatInr(agg?.serviceFeeSum ?? 0)}
                  hint="From reservation rows"
                />
              </div>
              <OutOfPocketKpiCluster
                byOwner={data?.outOfPocketByOwner ?? {}}
                owners={owners}
                onOwner={openOopExpenseList}
              />
            </div>
          </div>

          {data?.insights && data.insights.length > 0 && (
            <Card padding="responsive">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Insights</h2>
              <ul className="list-disc pl-5 space-y-2 text-sm text-[var(--text-secondary)]">
                {data.insights.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <Card padding="responsive" className="min-h-[260px] sm:min-h-[320px]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Expense mix</h2>
              {pieData.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">Add expenses to see the chart.</p>
              ) : (
                <div className="h-[240px] w-full sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          formatInr(Number(Array.isArray(value) ? value[0] : (value ?? 0)))
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card padding="responsive" className="min-h-[260px] sm:min-h-[320px]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Net cash trend</h2>
              {(data?.trend?.length ?? 0) === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No multi-month data yet.</p>
              ) : (
                <div className="h-[240px] w-full sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data!.trend} margin={{ left: -8, right: 8, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} width={36} />
                      <Tooltip
                        formatter={(value) =>
                          formatInr(Number(Array.isArray(value) ? value[0] : (value ?? 0)))
                        }
                      />
                      <Bar dataKey="netCash" fill="var(--accent)" name="Net cash" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

        </>
      )}
        </>
      )}

      <Modal open={addExpenseOpen} onOpenChange={setAddExpenseOpen} title="Add expense">
            <form onSubmit={onAddExpense} className="flex flex-col gap-3 overflow-y-auto p-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <ExpenseCategoryPicker
                    key={addExpenseOpen ? 'open' : 'closed'}
                    value={expenseType}
                    onChange={setExpenseType}
                  />
                </div>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Paid from
                  <Picker
                    value={expensePaidFrom}
                    onChange={(v) => setExpensePaidFrom(v as 'self' | 'out_of_pocket')}
                    options={[
                      { value: 'self', label: 'Self / operating' },
                      { value: 'out_of_pocket', label: 'Out of pocket' },
                    ]}
                  />
                </label>
                {expensePaidFrom === 'out_of_pocket' && (
                  <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)] sm:col-span-2">
                    Paid by
                    <Picker
                      value={expensePocketBy ?? ''}
                      onChange={(v) => setExpensePocketBy(v || null)}
                      options={owners.map((o) => ({ value: o.id, label: o.name }))}
                      placeholder="— select owner —"
                      className="sm:max-w-xs"
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Amount (INR)
                  <input
                    required
                    type="number"
                    min={0}
                    step={0.01}
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Date (optional)
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)] sm:col-span-2">
                  Notes
                  <input
                    value={expenseNotes}
                    onChange={(e) => setExpenseNotes(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAddExpenseOpen(false)}
                  className="min-h-11 rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] sm:min-h-9"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSaving}
                  className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[var(--bg-base)] text-sm font-semibold disabled:opacity-50 sm:min-h-9"
                >
                  {expenseSaving ? 'Saving…' : 'Save expense'}
                </button>
              </div>
            </form>
      </Modal>

      <Modal open={addDirectOpen} onOpenChange={setAddDirectOpen} title="Add direct booking" width="40rem">
            <form onSubmit={onAddDirect} className="flex flex-col gap-3 overflow-y-auto p-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Guest name
                  <input
                    required
                    value={dguest}
                    onChange={(e) => setDguest(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3 opacity-70" aria-hidden />
                    Phone (optional)
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+91 …"
                    value={dphone}
                    onChange={(e) => setDphone(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Number of guests
                  <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Optional"
                    value={dguestCount}
                    onChange={(e) => setDguestCount(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Amount received (INR)
                  <input
                    required
                    type="number"
                    min={0}
                    step={0.01}
                    value={damount}
                    onChange={(e) => setDamount(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Payment date
                  <input
                    type="date"
                    value={dreceived}
                    onChange={(e) => setDreceived(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Nights
                  <input
                    type="number"
                    min={0}
                    value={dnights}
                    onChange={(e) => setDnights(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Check-in
                  <input
                    type="date"
                    value={dcheckIn}
                    onChange={(e) => setDcheckIn(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Check-out
                  <input
                    type="date"
                    value={dcheckOut}
                    onChange={(e) => setDcheckOut(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)] sm:col-span-2 lg:col-span-3">
                  Notes
                  <input
                    value={dnotes}
                    onChange={(e) => setDnotes(e.target.value)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAddDirectOpen(false)}
                  className="min-h-11 rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] sm:min-h-9"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dsaving}
                  className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[var(--bg-base)] text-sm font-semibold disabled:opacity-50 sm:min-h-9"
                >
                  {dsaving ? 'Saving…' : 'Save direct booking'}
                </button>
              </div>
            </form>
      </Modal>

      <Modal
        open={directEditDraft != null}
        onOpenChange={(open) => {
          if (!open) setDirectEditDraft(null);
        }}
        title="Edit direct booking"
      >
            {directEditDraft && (
              <form onSubmit={onSaveDirectEdit} className="flex flex-col gap-3 overflow-y-auto p-4">
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Guest name
                  <input
                    required
                    value={directEditDraft.guest_name}
                    onChange={(e) =>
                      setDirectEditDraft((d) => (d ? { ...d, guest_name: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3 opacity-70" aria-hidden />
                    Phone
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+91 …"
                    value={directEditDraft.guest_phone}
                    onChange={(e) =>
                      setDirectEditDraft((d) => (d ? { ...d, guest_phone: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Number of guests
                  <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Blank = default (1 in totals)"
                    value={directEditDraft.guest_count}
                    onChange={(e) =>
                      setDirectEditDraft((d) => (d ? { ...d, guest_count: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Amount received (INR)
                  <input
                    required
                    type="number"
                    min={0}
                    step={0.01}
                    value={directEditDraft.amount}
                    onChange={(e) =>
                      setDirectEditDraft((d) => (d ? { ...d, amount: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Check-in
                  <input
                    type="date"
                    value={directEditDraft.check_in}
                    onChange={(e) =>
                      setDirectEditDraft((d) => (d ? { ...d, check_in: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Check-out
                  <input
                    type="date"
                    value={directEditDraft.check_out}
                    onChange={(e) =>
                      setDirectEditDraft((d) => (d ? { ...d, check_out: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Nights
                  <input
                    type="number"
                    min={0}
                    placeholder="Optional"
                    value={directEditDraft.nights}
                    onChange={(e) =>
                      setDirectEditDraft((d) => (d ? { ...d, nights: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Notes
                  <input
                    value={directEditDraft.notes}
                    onChange={(e) =>
                      setDirectEditDraft((d) => (d ? { ...d, notes: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setDirectEditDraft(null)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] sm:min-h-9"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={directEditSaving}
                    className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[var(--bg-base)] text-sm font-semibold disabled:opacity-50 sm:min-h-9"
                  >
                    {directEditSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
      </Modal>

      <Modal
        open={airbnbGuestEdit != null}
        onOpenChange={(open) => {
          if (!open) setAirbnbGuestEdit(null);
        }}
        title={`Guests — ${airbnbGuestEdit?.guest_label ?? 'Reservation'}`}
      >
            {airbnbGuestEdit && (
              <form onSubmit={onSaveAirbnbGuestEdit} className="flex flex-col gap-3 overflow-y-auto p-4">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  CSV inference (used when no manual count is saved):{' '}
                  <strong className="text-[var(--text-primary)] tabular-nums">{airbnbGuestEdit.guests_inferred}</strong>{' '}
                  guest{airbnbGuestEdit.guests_inferred === 1 ? '' : 's'}.
                </p>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Guest count (party size)
                  <input
                    type="number"
                    min={1}
                    max={99}
                    step={1}
                    placeholder="Leave blank to use CSV inference above"
                    value={airbnbGuestEdit.guest_count_input}
                    onChange={(e) =>
                      setAirbnbGuestEdit((d) => (d ? { ...d, guest_count_input: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setAirbnbGuestEdit(null)}
                    className="min-h-11 rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] sm:min-h-9"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={airbnbGuestEditSaving}
                    className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[var(--bg-base)] text-sm font-semibold disabled:opacity-50 sm:min-h-9"
                  >
                    {airbnbGuestEditSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}
      </Modal>

      <Modal
        open={activityOpen}
        onOpenChange={(open) => {
          setActivityOpen(open);
          if (!open) setActivityError(null);
        }}
        title={`Activity log — ${propertyName} P&L`}
        width="40rem"
      >
            <p id="activity-log-desc" className="px-4 pb-2 text-xs text-[var(--text-tertiary)] leading-relaxed">
              Expenses, direct bookings, Airbnb guest-count edits, and CSV imports — who changed what and when.
            </p>
            <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
              {activityLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-secondary)]">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Loading…
                </div>
              ) : activityError ? (
                <p className="py-12 text-center text-sm text-red-300">{activityError}</p>
              ) : activityEntries.length === 0 ? (
                <p className="py-12 text-center text-sm text-[var(--text-tertiary)]">
                  No activity recorded yet. Changes will appear here after you add or edit data.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-color)]/70 rounded-lg border border-[var(--border-color)]/50 bg-[var(--bg-elevated)]/40">
                  {activityEntries.map((e) => (
                    <li key={e.id} className="px-3 py-3 sm:px-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                          {e.action_label} · {e.resource_label}
                        </span>
                        <time
                          className="text-[11px] tabular-nums text-[var(--text-tertiary)] sm:text-xs"
                          dateTime={e.created_at}
                        >
                          {new Date(e.created_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </time>
                      </div>
                      <p className="mt-1.5 text-sm text-[var(--text-primary)] leading-relaxed">{e.display_line}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
      </Modal>

      <Modal
        open={oopListOpen}
        onOpenChange={(open) => {
          setOopListOpen(open);
          if (!open) {
            setOopListPayer(null);
            setOopListRows([]);
            setOopListError(null);
          }
        }}
        title={`Out of pocket — ${owners.find(o => o.id === oopListPayer)?.name ?? 'Owner'}`}
        width="34rem"
      >
            <div className="flex-1 overflow-auto p-4">
              {oopListLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-secondary)]">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Loading…
                </div>
              ) : oopListError ? (
                <p className="py-12 text-center text-sm text-red-300">{oopListError}</p>
              ) : oopListRows.length === 0 ? (
                <p className="py-12 text-center text-sm text-[var(--text-tertiary)]">
                  No out-of-pocket expenses for this payer yet.
                </p>
              ) : (
                <ResponsiveTable
                  table={
                    <div className="overflow-x-auto overscroll-x-contain touch-pan-x rounded-lg border border-[var(--border-color)]">
                      <table className="w-full min-w-[28rem] text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border-color)] bg-[var(--bg-elevated)] text-left text-[var(--text-tertiary)]">
                            <th className="px-3 py-2 font-medium">Month</th>
                            <th className="px-3 py-2 font-medium">Type</th>
                            <th className="px-3 py-2 font-medium">Amount</th>
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {oopListRows.map((r) => (
                            <tr key={r.id} className="border-b border-[var(--border-color)]/60">
                              <td className="whitespace-nowrap px-3 py-2 text-[var(--text-secondary)]">
                                {ymFromPeriodMonth(r.period_month)}
                              </td>
                              <td className="px-3 py-2 text-[var(--text-primary)]">{r.expense_type}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-[var(--text-secondary)]">
                                {formatInr(Number(r.amount))}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-[var(--text-secondary)]">
                                {r.expense_date ?? '—'}
                              </td>
                              <td className="max-w-[10rem] truncate px-3 py-2 text-[var(--text-secondary)] sm:max-w-none sm:whitespace-normal">
                                {stripFinancialTrackerBackfillFromNote(r.notes) ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                  cards={
                    <div className="space-y-3">
                      {oopListRows.map((r) => (
                        <TableCard
                          key={r.id}
                          title={<span className="font-medium text-sm text-[var(--text-primary)]">{ymFromPeriodMonth(r.period_month)}</span>}
                          titleExtra={<span className="text-sm text-[var(--text-secondary)]">{formatInr(Number(r.amount))}</span>}
                          fields={[
                            { label: 'Type', value: r.expense_type },
                            { label: 'Date', value: r.expense_date ?? '—' },
                            { label: 'Notes', value: stripFinancialTrackerBackfillFromNote(r.notes) ?? '—' },
                          ]}
                        />
                      ))}
                    </div>
                  }
                />
              )}
            </div>
      </Modal>

      <Modal
        open={expenseEditDraft != null}
        onOpenChange={(open) => {
          if (!open) setExpenseEditDraft(null);
        }}
        title="Edit expense"
      >
            {expenseEditDraft && (
              <form onSubmit={onSaveExpenseEdit} className="flex flex-col gap-3 overflow-y-auto p-4">
                <ExpenseCategoryPicker
                  key={expenseEditDraft.id}
                  value={expenseEditDraft.expense_type}
                  onChange={(v) => setExpenseEditDraft((d) => (d ? { ...d, expense_type: v } : null))}
                />
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Paid from
                  <Picker
                    value={expenseEditDraft.paid_from}
                    onChange={(v) =>
                      setExpenseEditDraft((d) =>
                        d ? { ...d, paid_from: v as 'self' | 'out_of_pocket' } : null,
                      )
                    }
                    options={[
                      { value: 'self', label: 'Self / operating' },
                      { value: 'out_of_pocket', label: 'Out of pocket' },
                    ]}
                  />
                </label>
                {expenseEditDraft.paid_from === 'out_of_pocket' && (
                  <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                    Paid by
                    <Picker
                      value={expenseEditDraft.owner_id ?? ''}
                      onChange={(v) =>
                        setExpenseEditDraft((d) => (d ? { ...d, owner_id: v || null } : null))
                      }
                      options={owners.map((o) => ({ value: o.id, label: o.name }))}
                      placeholder="— select owner —"
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Amount (INR)
                  <input
                    required
                    type="number"
                    min={0}
                    step={0.01}
                    value={expenseEditDraft.amount}
                    onChange={(e) =>
                      setExpenseEditDraft((d) => (d ? { ...d, amount: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Date (optional)
                  <input
                    type="date"
                    value={expenseEditDraft.expense_date}
                    onChange={(e) =>
                      setExpenseEditDraft((d) => (d ? { ...d, expense_date: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)]">
                  Notes
                  <input
                    value={expenseEditDraft.notes}
                    onChange={(e) =>
                      setExpenseEditDraft((d) => (d ? { ...d, notes: e.target.value } : null))
                    }
                    className="min-h-11 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base sm:text-sm text-[var(--text-primary)]"
                  />
                </label>
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setExpenseEditDraft(null)}
                    className="min-h-11 w-full rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={expenseEditSaving}
                    className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg-base)] disabled:opacity-50 sm:w-auto"
                  >
                    {expenseEditSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
      </Modal>

      <Modal open={allMonthsOpen} onOpenChange={setAllMonthsOpen} title="Summary — all months with data" width="52rem">
            <div className="flex-1 overflow-auto overflow-x-auto overscroll-x-contain touch-pan-x p-4">
              {allMonthsLoading ? (
                <div className="flex items-center gap-2 py-12 justify-center text-[var(--text-secondary)]">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Loading…
                </div>
              ) : allMonthsError ? (
                <p className="py-12 text-center text-sm text-red-300">{allMonthsError}</p>
              ) : allMonthsData && allMonthsData.months.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--text-secondary)]">
                    {allMonthsData.monthCount} month{allMonthsData.monthCount === 1 ? '' : 's'} with expenses, direct bookings,
                    or Airbnb imports. Out-of-pocket columns include only expenses tagged Teja or Indu (not self / operating).
                  </p>
                  <ResponsiveTable
                    table={
                      <div className="overflow-x-auto overscroll-x-contain touch-pan-x rounded-lg border border-[var(--border-color)]">
                        <table className="w-full min-w-[52rem] text-xs sm:text-sm">
                          <thead>
                            <tr className="text-left text-[var(--text-tertiary)] border-b border-[var(--border-color)] bg-[var(--bg-elevated)]">
                              <th className="px-3 py-2 font-medium whitespace-nowrap">Month</th>
                              <th className="px-3 py-2 font-medium whitespace-nowrap">Expenses</th>
                              <th className="px-3 py-2 font-medium whitespace-nowrap">OOP Teja</th>
                              <th className="px-3 py-2 font-medium whitespace-nowrap">OOP Indu</th>
                              <th className="px-3 py-2 font-medium whitespace-nowrap">Direct</th>
                              <th className="px-3 py-2 font-medium whitespace-nowrap">Airbnb payouts</th>
                              <th className="px-3 py-2 font-medium whitespace-nowrap">Cash in (est.)</th>
                              <th className="px-3 py-2 font-medium whitespace-nowrap">Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allMonthsData.months.map((m) => (
                              <tr key={m.periodMonth} className="border-b border-[var(--border-color)]/60">
                                <td className="px-3 py-2 font-medium text-[var(--text-primary)] whitespace-nowrap">{m.month}</td>
                                <td className="px-3 py-2 text-[var(--text-secondary)]">{formatInr(m.expenseTotal)}</td>
                                <td className="px-3 py-2 text-[var(--text-secondary)]">{formatInr(m.outOfPocketTeja ?? 0)}</td>
                                <td className="px-3 py-2 text-[var(--text-secondary)]">{formatInr(m.outOfPocketIndu ?? 0)}</td>
                                <td className="px-3 py-2 text-[var(--text-secondary)]">{formatInr(m.directTotal)}</td>
                                <td className="px-3 py-2 text-[var(--text-secondary)]">{formatInr(m.bankPayouts)}</td>
                                <td className="px-3 py-2 text-[var(--text-secondary)]">{formatInr(m.cashInboundEstimate)}</td>
                                <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{formatInr(m.netCash)}</td>
                              </tr>
                            ))}
                            <tr className="bg-[var(--accent)]/10 font-semibold border-t-2 border-[var(--accent)]/40">
                              <td className="px-3 py-2 text-[var(--text-primary)]">Total</td>
                              <td className="px-3 py-2 text-[var(--text-primary)]">
                                {formatInr(allMonthsData.grandTotals.expenseTotal)}
                              </td>
                              <td className="px-3 py-2 text-[var(--text-primary)]">
                                {formatInr(allMonthsData.grandTotals.outOfPocketByPayer?.teja ?? 0)}
                              </td>
                              <td className="px-3 py-2 text-[var(--text-primary)]">
                                {formatInr(allMonthsData.grandTotals.outOfPocketByPayer?.indu ?? 0)}
                              </td>
                              <td className="px-3 py-2 text-[var(--text-primary)]">
                                {formatInr(allMonthsData.grandTotals.directTotal)}
                              </td>
                              <td className="px-3 py-2 text-[var(--text-primary)]">
                                {formatInr(allMonthsData.grandTotals.bankPayouts)}
                              </td>
                              <td className="px-3 py-2 text-[var(--text-primary)]">
                                {formatInr(allMonthsData.grandTotals.cashInboundEstimate)}
                              </td>
                              <td className="px-3 py-2 text-[var(--accent)]">{formatInr(allMonthsData.grandTotals.netCash)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    }
                    cards={
                      <div className="space-y-3">
                        {allMonthsData.months.map((m) => (
                          <TableCard
                            key={m.periodMonth}
                            title={<span className="font-medium text-sm text-[var(--text-primary)]">{m.month}</span>}
                            titleExtra={<span className="font-medium text-sm text-[var(--text-primary)]">{formatInr(m.netCash)}</span>}
                            fields={[
                              { label: 'Expenses', value: formatInr(m.expenseTotal) },
                              { label: 'OOP Teja', value: formatInr(m.outOfPocketTeja ?? 0) },
                              { label: 'OOP Indu', value: formatInr(m.outOfPocketIndu ?? 0) },
                              { label: 'Direct', value: formatInr(m.directTotal) },
                              { label: 'Airbnb payouts', value: formatInr(m.bankPayouts) },
                              { label: 'Cash in (est.)', value: formatInr(m.cashInboundEstimate) },
                            ]}
                          />
                        ))}
                        <div className="rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4 space-y-2.5">
                          <span className="font-semibold text-sm text-[var(--text-primary)]">Total</span>
                          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                            {[
                              { label: 'Expenses', value: formatInr(allMonthsData.grandTotals.expenseTotal) },
                              { label: 'OOP Teja', value: formatInr(allMonthsData.grandTotals.outOfPocketByPayer?.teja ?? 0) },
                              { label: 'OOP Indu', value: formatInr(allMonthsData.grandTotals.outOfPocketByPayer?.indu ?? 0) },
                              { label: 'Direct', value: formatInr(allMonthsData.grandTotals.directTotal) },
                              { label: 'Airbnb payouts', value: formatInr(allMonthsData.grandTotals.bankPayouts) },
                              { label: 'Cash in (est.)', value: formatInr(allMonthsData.grandTotals.cashInboundEstimate) },
                              { label: 'Net', value: formatInr(allMonthsData.grandTotals.netCash), accent: true },
                            ].map((f, i) => (
                              <div key={i} className="min-w-0">
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{f.label}</dt>
                                <dd className={`text-sm font-semibold ${f.accent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{f.value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                    }
                  />
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-[var(--text-tertiary)]">
                  No multi-month data yet — log expenses, direct bookings, or import Airbnb CSV.
                </p>
              )}
            </div>
      </Modal>
    </div>
  );
}

function OutOfPocketKpiCluster({
  byOwner,
  owners,
  onOwner,
}: {
  byOwner: Record<string, number>;
  owners: Array<{ id: string; name: string }>;
  onOwner: (ownerId: string) => void;
}) {
  const combined = Object.values(byOwner).reduce((s, v) => s + v, 0);

  return (
    <div className="min-w-0 w-full h-fit rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/25 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-[var(--border-color)]/60 pb-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-200/95 sm:text-xs">
          Out of pocket · all-time
        </p>
        <p className="text-lg font-bold tabular-nums text-fuchsia-100 font-[family-name:var(--font-geist-mono)] leading-tight sm:text-xl">
          {formatInr(combined)}
        </p>
      </div>
      {owners.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">No co-owners configured.</p>
      ) : (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:gap-2">
          {owners.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onOwner(o.id)}
              className="min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]/90 px-2.5 py-2 text-left transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--bg-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.99] sm:px-3"
            >
              <p className="text-[11px] text-[var(--text-tertiary)] sm:text-xs">{o.name}</p>
              <p className="mt-0.5 break-words text-base font-bold tabular-nums text-[var(--text-primary)] font-[family-name:var(--font-geist-mono)] leading-tight sm:mt-1 sm:text-lg">
                {formatInr(byOwner[o.id] ?? 0)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityKpi({
  bookingAirbnb,
  bookingDirect,
  nightsAirbnb,
  nightsDirect,
  guestsMonthTotal,
  guestsMonthAirbnb,
  guestsMonthDirect,
  guestsAllTimeTotal,
  guestsAllTimeAirbnb,
  guestsAllTimeDirect,
}: {
  bookingAirbnb: number;
  bookingDirect: number;
  nightsAirbnb: number;
  nightsDirect: number;
  guestsMonthTotal: number;
  guestsMonthAirbnb: number;
  guestsMonthDirect: number;
  guestsAllTimeTotal: number;
  guestsAllTimeAirbnb: number;
  guestsAllTimeDirect: number;
}) {
  const bookingTotal = bookingAirbnb + bookingDirect;
  const nightsTotal = nightsAirbnb + nightsDirect;

  return (
    <div
      className="flex h-full min-h-0 min-w-0 w-full flex-col gap-2 rounded-xl border border-emerald-500/45 bg-emerald-950/30 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      aria-label={`Activity: ${bookingTotal} bookings, ${nightsTotal} nights; guests this month ${guestsMonthTotal}, all-time ${guestsAllTimeTotal}`}
    >
      <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-emerald-200/90 sm:text-[13px]">
        Stays & guests
      </p>

      <div className="grid shrink-0 grid-cols-2 gap-2">
        <div className="rounded-md border border-emerald-500/20 bg-black/20 px-2.5 py-2">
          <p className="text-xs text-[var(--text-tertiary)]">Bookings</p>
          <p className="text-lg font-bold tabular-nums text-emerald-50 font-[family-name:var(--font-geist-mono)] leading-tight sm:text-xl">
            {bookingTotal}
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--text-tertiary)]">
            <span className="text-emerald-400/90">{bookingAirbnb}</span> Airbnb ·{' '}
            <span className="text-sky-400/90">{bookingDirect}</span> direct
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-black/20 px-2.5 py-2">
          <p className="text-xs text-[var(--text-tertiary)]">Nights booked</p>
          <p className="text-lg font-bold tabular-nums text-emerald-50 font-[family-name:var(--font-geist-mono)] leading-tight sm:text-xl">
            {nightsTotal}
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--text-tertiary)]">
            <span className="text-emerald-400/90">{nightsAirbnb}</span> Airbnb ·{' '}
            <span className="text-sky-400/90">{nightsDirect}</span> direct
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-emerald-500/25 bg-black/25">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-500/20 bg-emerald-950/50 px-2.5 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90 sm:text-[13px]">
            Guest headcount
          </span>
          <span
            className="text-[11px] text-emerald-400/80 cursor-help shrink-0 underline decoration-dotted underline-offset-2 sm:text-xs"
            title="Direct: party size per booking (or 1). Airbnb: “Number of guests” in CSV when present, else 1 per reservation."
          >
            How we count
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-[12px] leading-snug sm:text-[13px]">
            <caption className="sr-only">
              Guest headcounts for this statement month versus all-time, split by Airbnb and direct
            </caption>
            <thead>
              <tr className="border-b border-emerald-500/15 text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] sm:text-xs">
                <th
                  scope="col"
                  aria-hidden
                  className="w-[34%] max-w-[7rem] border-0 py-1 pl-2"
                />
                <th scope="col" className="px-1.5 py-1 text-center font-semibold text-emerald-200/90">
                  This month
                </th>
                <th scope="col" className="py-1 pr-2 pl-1.5 text-center font-semibold text-emerald-200/90">
                  All-time
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums font-[family-name:var(--font-geist-mono)]">
              <tr className="border-b border-emerald-500/10 bg-emerald-950/20">
                <th scope="row" className="py-1.5 pl-2 pr-1.5 text-left font-medium text-[var(--text-secondary)]">
                  Total
                </th>
                <td className="px-1.5 py-1.5 text-center font-semibold text-emerald-50">{guestsMonthTotal}</td>
                <td className="py-1.5 pr-2 pl-1.5 text-center font-semibold text-emerald-50">{guestsAllTimeTotal}</td>
              </tr>
              <tr className="border-b border-emerald-500/10">
                <th scope="row" className="py-1.5 pl-2 pr-1.5 text-left font-medium text-emerald-400/95">
                  Airbnb
                </th>
                <td className="px-1.5 py-1.5 text-center font-semibold text-emerald-300">{guestsMonthAirbnb}</td>
                <td className="py-1.5 pr-2 pl-1.5 text-center font-semibold text-emerald-300">{guestsAllTimeAirbnb}</td>
              </tr>
              <tr>
                <th scope="row" className="py-1.5 pl-2 pr-1.5 text-left font-medium text-sky-400/95">
                  Direct
                </th>
                <td className="px-1.5 py-1.5 text-center font-semibold text-sky-300">{guestsMonthDirect}</td>
                <td className="py-1.5 pr-2 pl-1.5 text-center font-semibold text-sky-300">{guestsAllTimeDirect}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  onClick,
  className,
  tone = 'neutral',
  compact,
  dense,
}: {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
  className?: string;
  tone?: KpiTone;
  compact?: boolean;
  /** Tighter padding + type scale for paired grids (matches activity column height) */
  dense?: boolean;
}) {
  const shellTone = KPI_TONE_SHELL[tone];
  const valueTone = KPI_TONE_VALUE[tone];
  const pad = dense ? 'p-2' : compact ? 'p-3' : 'p-4';
  const valueSize = dense
    ? 'text-base sm:text-lg leading-tight tracking-tight'
    : compact
      ? 'text-lg sm:text-xl leading-tight tracking-tight'
      : 'text-lg';
  const hintMt = compact || dense ? 'mt-0.5' : 'mt-2';
  const shell = `min-w-0 rounded-xl ${pad} text-left w-full h-fit shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${shellTone} ${
    onClick
      ? 'cursor-pointer transition-colors hover:brightness-110 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
      : ''
  } ${className ?? ''}`;

  const inner = (
    <>
      <p
        className={`${
          dense
            ? 'text-[11px] sm:text-xs font-semibold uppercase tracking-wide'
            : compact
              ? 'text-[11px] sm:text-xs font-semibold uppercase tracking-wide'
              : 'text-xs'
        } ${tone === 'neutral' ? 'text-[var(--text-tertiary)]' : 'text-white/55'}`}
      >
        {label}
      </p>
      <p
        className={`break-words ${valueSize} font-bold ${dense ? 'mt-0.5' : 'mt-1'} font-[family-name:var(--font-geist-mono)] ${valueTone}`}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={`block w-full text-right ${dense ? 'text-[10px] sm:text-[11px]' : compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px]'} ${hintMt} leading-snug ${
            tone === 'neutral'
              ? 'text-[var(--text-tertiary)]'
              : compact || dense
                ? 'text-white/50'
                : 'text-white/40'
          }`}
        >
          {hint}
        </p>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {inner}
      </button>
    );
  }

  return <div className={shell}>{inner}</div>;
}
