import { formatExpensePaidLabel } from '@/lib/property-finance/expense-paid-source';
import { stripFinancialTrackerBackfillFromNote } from '@/lib/property-finance/strip-tracker-backfill-note';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type MonthEndReportPayload = {
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
  expenses: Array<{
    expense_type: string;
    amount: number;
    expense_date: string | null;
    notes: string | null;
    paid_from?: string | null;
    owner_id?: string | null;
  }>;
  directBookings: Array<{
    guest_name: string;
    amount: number;
    guest_count: number | null;
    guest_phone?: string | null;
    received_date: string | null;
    check_in: string | null;
    check_out: string | null;
    nights: number | null;
    notes: string | null;
  }>;
  reservationPreview: Array<{
    guest: string | null;
    start_date: string | null;
    end_date: string | null;
    nights: number | null;
    gross_earnings: number | null;
    amount: number | null;
    paid_out: number | null;
    service_fee: number | null;
    guest_count?: number | null;
    guests_inferred?: number;
    guests_effective?: number;
  }>;
  airbnbRowCount: number;
  /** Lifetime out-of-pocket totals keyed by owner UUID */
  outOfPocketByOwner?: Record<string, number>;
  /** Owner name lookup, keyed by owner UUID */
  ownerNames?: Record<string, string>;
};

function fmtInr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildMonthEndCsv(payload: MonthEndReportPayload): string {
  const lines: string[] = [];
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  lines.push(`Tamarind P&L month-end report`);
  lines.push(`Period,${csvEscape(payload.month)}`);
  lines.push(`Generated (UTC),${csvEscape(now)}`);
  lines.push('');
  lines.push('SUMMARY');
  lines.push(`Metric,Amount (INR)`);
  lines.push(`${csvEscape('Airbnb bank payouts')},${fmtInr(payload.aggregates.bankPayouts)}`);
  lines.push(`${csvEscape('Tax withholding')},${fmtInr(payload.aggregates.taxWithholding)}`);
  lines.push(`${csvEscape('Days booked (total nights)')},${String(payload.aggregates.daysBooked)}`);
  lines.push(`${csvEscape('Days booked — Airbnb')},${String(payload.aggregates.daysBookedAirbnb)}`);
  lines.push(`${csvEscape('Days booked — Direct')},${String(payload.aggregates.daysBookedDirect)}`);
  lines.push(`${csvEscape('Bookings — Airbnb')},${String(payload.aggregates.reservationCount)}`);
  lines.push(`${csvEscape('Bookings — Direct')},${String(payload.aggregates.directBookingCount)}`);
  lines.push(
    `${csvEscape('Average guest charge per night')},${
      payload.aggregates.averageGuestChargePerNight != null
        ? fmtInr(payload.aggregates.averageGuestChargePerNight)
        : ''
    }`,
  );
  lines.push(`${csvEscape('Airbnb service fees')},${fmtInr(payload.aggregates.serviceFeeSum)}`);
  lines.push(`${csvEscape('Direct booking revenue')},${fmtInr(payload.aggregates.directTotal)}`);
  lines.push(`${csvEscape('Total expenses')},${fmtInr(payload.aggregates.expenseTotal)}`);
  lines.push(
    `${csvEscape('Bookings (Airbnb + direct, count)')},${String(payload.aggregates.totalBookingCount)}`,
  );
  lines.push(
    `${csvEscape('Avg cost per booking')},${
      payload.aggregates.averageCostPerBooking != null
        ? fmtInr(payload.aggregates.averageCostPerBooking)
        : ''
    }`,
  );
  lines.push(`${csvEscape('Guests (month · total)')},${String(payload.aggregates.guestsMonthTotal)}`);
  lines.push(`${csvEscape('Guests (month · Airbnb)')},${String(payload.aggregates.guestsMonthAirbnb)}`);
  lines.push(`${csvEscape('Guests (month · direct)')},${String(payload.aggregates.guestsMonthDirect)}`);
  lines.push(`${csvEscape('Guests (all-time · total)')},${String(payload.aggregates.guestsAllTimeTotal)}`);
  lines.push(`${csvEscape('Guests (all-time · Airbnb)')},${String(payload.aggregates.guestsAllTimeAirbnb)}`);
  lines.push(`${csvEscape('Guests (all-time · direct)')},${String(payload.aggregates.guestsAllTimeDirect)}`);
  lines.push(`${csvEscape('Cash in (estimate)')},${fmtInr(payload.aggregates.cashInboundEstimate)}`);
  lines.push(`${csvEscape('Net after expenses')},${fmtInr(payload.aggregates.netCash)}`);
  for (const [ownerId, total] of Object.entries(payload.outOfPocketByOwner ?? {})) {
    const name = payload.ownerNames?.[ownerId] ?? ownerId;
    lines.push(`${csvEscape(`Out of pocket — ${name} (all months)`)},${fmtInr(total)}`);
  }
  lines.push('');
  lines.push('EXPENSES BY CATEGORY');
  lines.push(`Category,Amount (INR)`);
  for (const [k, v] of Object.entries(payload.aggregates.expenseByCategory).sort((a, b) => b[1] - a[1])) {
    lines.push(`${csvEscape(k)},${fmtInr(v)}`);
  }
  lines.push('');
  lines.push('INSIGHTS');
  if (payload.insights.length === 0) lines.push(csvEscape('—'));
  else payload.insights.forEach((t) => lines.push(csvEscape(t)));
  lines.push('');
  lines.push('EXPENSES (LINE ITEMS)');
  lines.push(`Type,Paid from,Amount (INR),Date,Notes`);
  for (const e of payload.expenses) {
    lines.push(
      [
        csvEscape(e.expense_type),
        csvEscape(formatExpensePaidLabel(e.paid_from, e.owner_id ? (payload.ownerNames?.[e.owner_id] ?? e.owner_id) : null)),
        fmtInr(Number(e.amount)),
        csvEscape(e.expense_date ?? ''),
        csvEscape(stripFinancialTrackerBackfillFromNote(e.notes) ?? ''),
      ].join(','),
    );
  }
  lines.push('');
  lines.push('DIRECT BOOKINGS');
  lines.push(`Guest name,Phone,Guests,Amount (INR),Payment date,Check-in,Check-out,Nights,Notes`);
  for (const d of payload.directBookings) {
    lines.push(
      [
        csvEscape(d.guest_name),
        csvEscape(d.guest_phone ?? ''),
        d.guest_count != null ? String(d.guest_count) : '',
        fmtInr(Number(d.amount)),
        csvEscape(d.received_date ?? ''),
        csvEscape(d.check_in ?? ''),
        csvEscape(d.check_out ?? ''),
        d.nights != null ? String(d.nights) : '',
        csvEscape(stripFinancialTrackerBackfillFromNote(d.notes) ?? ''),
      ].join(','),
    );
  }
  lines.push('');
  lines.push(`AIRBNB IMPORT ROWS (count),${String(payload.airbnbRowCount)}`);
  lines.push('AIRBNB RESERVATIONS (PREVIEW)');
  lines.push(`Guest,Stay start,Stay end,Nights,Guests (used),Gross (INR),Host payout (INR),Service fee (INR)`);
  for (const r of payload.reservationPreview) {
    const guestsUsed =
      r.guests_effective != null && Number.isFinite(Number(r.guests_effective))
        ? String(r.guests_effective)
        : '';
    lines.push(
      [
        csvEscape(r.guest ?? ''),
        csvEscape(r.start_date ?? ''),
        csvEscape(r.end_date ?? ''),
        r.nights != null ? String(r.nights) : '',
        guestsUsed,
        r.gross_earnings != null ? fmtInr(Number(r.gross_earnings)) : '',
        r.amount != null ? fmtInr(Number(r.amount)) : '',
        r.service_fee != null ? fmtInr(Number(r.service_fee)) : '',
      ].join(','),
    );
  }
  return lines.join('\r\n');
}

export function downloadMonthEndCsv(payload: MonthEndReportPayload, filename?: string): void {
  const csv = buildMonthEndCsv(payload);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `Tamarind-finances-${payload.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMonthEndPdf(payload: MonthEndReportPayload, filename?: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = 18;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Tamarind P&L — month end', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Period: ${payload.month}`, margin, y);
  y += 5;
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)} (UTC date)`, margin, y);
  y += 10;

  const oopEntries = Object.entries(payload.outOfPocketByOwner ?? {});
  const summaryBody: string[][] = [
    ['Airbnb bank payouts', fmtInr(payload.aggregates.bankPayouts)],
    ['Tax withholding', fmtInr(payload.aggregates.taxWithholding)],
    ['Days booked (total nights)', String(payload.aggregates.daysBooked)],
    ['Days booked — Airbnb', String(payload.aggregates.daysBookedAirbnb)],
    ['Days booked — Direct', String(payload.aggregates.daysBookedDirect)],
    ['Bookings — Airbnb', String(payload.aggregates.reservationCount)],
    ['Bookings — Direct', String(payload.aggregates.directBookingCount)],
    [
      'Average guest charge per night',
      payload.aggregates.averageGuestChargePerNight != null
        ? fmtInr(payload.aggregates.averageGuestChargePerNight)
        : '—',
    ],
    ['Airbnb service fees', fmtInr(payload.aggregates.serviceFeeSum)],
    ['Direct booking revenue', fmtInr(payload.aggregates.directTotal)],
    ['Total expenses', fmtInr(payload.aggregates.expenseTotal)],
    [
      'Bookings (Airbnb + direct)',
      String(payload.aggregates.totalBookingCount),
    ],
    [
      'Avg cost per booking',
      payload.aggregates.averageCostPerBooking != null
        ? fmtInr(payload.aggregates.averageCostPerBooking)
        : '—',
    ],
    ['Guests (month · total)', String(payload.aggregates.guestsMonthTotal)],
    ['Guests (month · Airbnb)', String(payload.aggregates.guestsMonthAirbnb)],
    ['Guests (month · direct)', String(payload.aggregates.guestsMonthDirect)],
    ['Guests (all-time · total)', String(payload.aggregates.guestsAllTimeTotal)],
    ['Guests (all-time · Airbnb)', String(payload.aggregates.guestsAllTimeAirbnb)],
    ['Guests (all-time · direct)', String(payload.aggregates.guestsAllTimeDirect)],
    ['Cash in (estimate)', fmtInr(payload.aggregates.cashInboundEstimate)],
    ['Net after expenses', fmtInr(payload.aggregates.netCash)],
    ...oopEntries.map(([ownerId, total]) => {
      const name = payload.ownerNames?.[ownerId] ?? ownerId;
      return [`Out of pocket — ${name} (all months)`, fmtInr(total)];
    }),
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Metric', 'Value (INR)']],
    body: summaryBody,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [8, 177, 68], textColor: 255, fontStyle: 'bold' },
    theme: 'grid',
  });

  let py =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  py += 8;

  if (py > 250) {
    doc.addPage();
    py = margin;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Insights', margin, py);
  py += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (payload.insights.length === 0) {
    doc.text('—', margin, py);
    py += 6;
  } else {
    payload.insights.forEach((t) => {
      const wrapped = doc.splitTextToSize(`• ${t}`, pageW - margin * 2);
      const h = Array.isArray(wrapped) ? wrapped.length * 4 : 4;
      if (py + h > 280) {
        doc.addPage();
        py = margin;
      }
      doc.text(wrapped, margin, py);
      py += h + 2;
    });
  }
  py += 4;

  const catRows = Object.entries(payload.aggregates.expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, fmtInr(v)]);
  if (catRows.length > 0) {
    if (py > 230) {
      doc.addPage();
      py = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Expenses by category', margin, py);
    py += 6;
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: py,
      margin: { left: margin, right: margin },
      head: [['Category', 'Amount (INR)']],
      body: catRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [8, 177, 68], textColor: 255, fontStyle: 'bold' },
      theme: 'grid',
    });
    py = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? py + 24;
    py += 8;
  }

  if (py > 220) {
    doc.addPage();
    py = margin;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Expense line items', margin, py);
  py += 6;
  doc.setFont('helvetica', 'normal');
  const expBody = payload.expenses.map((e) => [
    e.expense_type,
    formatExpensePaidLabel(e.paid_from, e.owner_id ? (payload.ownerNames?.[e.owner_id] ?? e.owner_id) : null),
    fmtInr(Number(e.amount)),
    e.expense_date ?? '—',
    (stripFinancialTrackerBackfillFromNote(e.notes) ?? '').slice(0, 100),
  ]);
  autoTable(doc, {
    startY: py,
    margin: { left: margin, right: margin },
    head: [['Type', 'Paid from', 'Amount', 'Date', 'Notes']],
    body: expBody.length ? expBody : [['—', '—', '—', '—', 'No expenses']],
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [8, 177, 68], textColor: 255, fontStyle: 'bold' },
    theme: 'grid',
    columnStyles: { 4: { cellWidth: 58 } },
  });
  py = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? py + 30;
  py += 8;

  if (py > 200) {
    doc.addPage();
    py = margin;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Direct bookings', margin, py);
  py += 6;
  doc.setFont('helvetica', 'normal');
  const dirBody = payload.directBookings.map((d) => [
    d.guest_name,
    (d.guest_phone ?? '').trim() || '—',
    d.guest_count != null ? String(d.guest_count) : '—',
    fmtInr(Number(d.amount)),
    d.received_date ?? '—',
    `${d.check_in ?? '—'} → ${d.check_out ?? '—'}`,
    d.nights != null ? String(d.nights) : '—',
    (stripFinancialTrackerBackfillFromNote(d.notes) ?? '').slice(0, 50),
  ]);
  autoTable(doc, {
    startY: py,
    margin: { left: margin, right: margin },
    head: [['Guest', 'Phone', 'Guests', 'Amount', 'Paid', 'Stay', 'Nights', 'Notes']],
    body: dirBody.length ? dirBody : [['—', '—', '—', '—', '—', '—', '—', 'No direct bookings']],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [8, 177, 68], textColor: 255, fontStyle: 'bold' },
    theme: 'grid',
  });
  py = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? py + 24;
  py += 8;

  if (py > 210) {
    doc.addPage();
    py = margin;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Airbnb reservations (preview) — import rows: ${payload.airbnbRowCount}`, margin, py);
  py += 6;
  doc.setFont('helvetica', 'normal');
  const resBody = payload.reservationPreview.map((r) => [
    (r.guest ?? '—').slice(0, 28),
    r.start_date ?? '—',
    r.end_date ?? '—',
    r.nights != null ? String(r.nights) : '—',
    r.guests_effective != null && Number.isFinite(Number(r.guests_effective))
      ? String(r.guests_effective)
      : '—',
    r.gross_earnings != null ? fmtInr(Number(r.gross_earnings)) : '—',
    r.amount != null ? fmtInr(Number(r.amount)) : '—',
    r.service_fee != null ? fmtInr(Number(r.service_fee)) : '—',
  ]);
  autoTable(doc, {
    startY: py,
    margin: { left: margin, right: margin },
    head: [['Guest', 'Start', 'End', 'Nights', 'Guests', 'Gross', 'Host payout', 'Fee']],
    body: resBody.length ? resBody : [['—', '—', '—', '—', '—', '—', '—', 'Import CSV for data']],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [8, 177, 68], textColor: 255, fontStyle: 'bold' },
    theme: 'grid',
  });

  doc.save(filename ?? `Tamarind-finances-${payload.month}.pdf`);
}
