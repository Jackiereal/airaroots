/** Airbnb transaction report CSV (e.g. Indian payout export). */

export type AirbnbCsvRow = {
  row_date: string | null;
  arriving_by_date: string | null;
  row_type: string;
  confirmation_code: string | null;
  booking_date: string | null;
  start_date: string | null;
  end_date: string | null;
  nights: number | null;
  guest: string | null;
  listing: string | null;
  details: string | null;
  reference_code: string | null;
  currency: string | null;
  amount: number | null;
  paid_out: number | null;
  service_fee: number | null;
  fast_pay_fee: number | null;
  cleaning_fee: number | null;
  gross_earnings: number | null;
  airbnb_remitted_tax: number | null;
  earnings_year: string | null;
  raw: Record<string, string>;
};

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function splitCsvRows(text: string): string[] {
  const lines: string[] = [];
  let row = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        row += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        row += c;
      }
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      const trimmed = row.trim();
      if (trimmed.length) lines.push(trimmed);
      row = '';
    } else {
      row += c;
    }
  }
  const last = row.trim();
  if (last.length) lines.push(last);
  return lines;
}

export function parseMoneyCell(s: string | undefined): number | null {
  if (s == null || s.trim() === '') return null;
  const cleaned = s.replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseUsDate(s: string | undefined): string | null {
  if (!s || !s.trim()) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const mm = m[1].padStart(2, '0');
  const dd = m[2].padStart(2, '0');
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function parseIntCell(s: string | undefined): number | null {
  if (!s || !s.trim()) return null;
  const n = Number.parseInt(s.replace(/,/g, '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

const EXPECTED_HEADERS = [
  'Date',
  'Arriving by date',
  'Type',
  'Confirmation Code',
  'Booking date',
  'Start date',
  'End date',
  'Nights',
  'Guest',
  'Listing',
  'Details',
  'Reference code',
  'Currency',
  'Amount',
  'Paid out',
  'Service fee',
  'Fast Pay Fee',
  'Cleaning fee',
  'Gross earnings',
  'Airbnb remitted tax',
  'Earnings year',
];

export function parseAirbnbCsv(text: string): { rows: AirbnbCsvRow[]; headersOk: boolean } {
  const rawLines = splitCsvRows(text.replace(/^\uFEFF/, ''));
  if (rawLines.length === 0) return { rows: [], headersOk: false };

  const headerCells = parseCsvLine(rawLines[0]).map((h) => h.trim());
  const headersOk =
    headerCells.length >= 15 &&
    headerCells[0] === EXPECTED_HEADERS[0] &&
    headerCells[2] === EXPECTED_HEADERS[2];

  const rows: AirbnbCsvRow[] = [];
  for (let li = 1; li < rawLines.length; li++) {
    const cells = parseCsvLine(rawLines[li]);
    const get = (i: number) => cells[i]?.trim() ?? '';

    const raw: Record<string, string> = {};
    headerCells.forEach((h, idx) => {
      raw[h] = cells[idx] ?? '';
    });

    const row_type = get(2) || 'Unknown';
    rows.push({
      row_date: parseUsDate(get(0)),
      arriving_by_date: parseUsDate(get(1)),
      row_type,
      confirmation_code: get(3) || null,
      booking_date: parseUsDate(get(4)),
      start_date: parseUsDate(get(5)),
      end_date: parseUsDate(get(6)),
      nights: parseIntCell(get(7)),
      guest: get(8) || null,
      listing: get(9) || null,
      details: get(10) || null,
      reference_code: get(11) || null,
      currency: get(12) || null,
      amount: parseMoneyCell(get(13)),
      paid_out: parseMoneyCell(get(14)),
      service_fee: parseMoneyCell(get(15)),
      fast_pay_fee: parseMoneyCell(get(16)),
      cleaning_fee: parseMoneyCell(get(17)),
      gross_earnings: parseMoneyCell(get(18)),
      airbnb_remitted_tax: parseMoneyCell(get(19)),
      earnings_year: get(20) || null,
      raw,
    });
  }

  return { rows, headersOk };
}

/** First day of calendar month (YYYY-MM-01). */
export function toPeriodMonth(isoYearMonth: string): string {
  const [y, m] = isoYearMonth.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error('Invalid month');
  return `${y}-${String(m).padStart(2, '0')}-01`;
}
