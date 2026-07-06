/**
 * Parses Numbers-export style monthly sheets (REVENUE + EXPENSES sections).
 * Not compatible with Airbnb transaction CSV — use parseAirbnbCsv for those.
 */

import { parseCsvLine } from '@/lib/property-finance/parse-airbnb-csv';

export type TrackerRevenueRow = {
  date_raw: string;
  date_iso: string | null;
  platform: string;
  guest_name: string;
  nights: number | null;
  booking_amount: number | null;
  revenue: number | null;
  cleaning_fee: number | null;
  extra_charge: number | null;
  platform_charge: number | null;
  notes: string;
};

export type TrackerExpenseRow = {
  date_raw: string;
  date_iso: string | null;
  category: string;
  description: string;
  vendor: string;
  amount: number | null;
  payment_notes: string;
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/** e.g. "December 2025-Table 1.csv" -> "2025-12-01" */
export function periodMonthFromTrackerFilename(filename: string): string | null {
  const base = filename.replace(/\.csv$/i, '');
  const re = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i;
  const m = re.exec(base);
  if (!m) return null;
  const mi = MONTHS[m[1].toLowerCase()];
  const year = Number(m[2]);
  if (!mi || !year) return null;
  return `${year}-${String(mi).padStart(2, '0')}-01`;
}

export function parseMoneyLoose(s: string | undefined): number | null {
  if (s == null || !String(s).trim()) return null;
  const cleaned = String(s).replace(/[₹,\s]/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** MM/DD/YYYY or MM/DD/YY; fixes `/0206` year typo → 2026. */
export function parseTrackerUsDate(raw: string): { iso: string | null; fixedTypo?: string } {
  let s = raw.trim();
  if (!s) return { iso: null };
  let fixedTypo: string | undefined;
  if (/\d{1,2}\/\d{1,2}\/0206$/i.test(s)) {
    fixedTypo = `${s} → ${s.replace(/0206$/i, '2026')}`;
    s = s.replace(/0206$/i, '2026');
  }

  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (!m) return { iso: null, fixedTypo };

  const mm = Number.parseInt(m[1], 10);
  const dd = Number.parseInt(m[2], 10);
  let yyyy = Number.parseInt(m[3], 10);
  if (yyyy < 100) yyyy += 2000;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { iso: null, fixedTypo };

  return {
    iso: `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
    fixedTypo,
  };
}

function splitLines(text: string): string[] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd());
}

function isTotalRow(cells: string[]): boolean {
  const joined = cells.join(',').toLowerCase();
  return joined.includes(',total,') || cells.some((c) => c.trim().toLowerCase() === 'total');
}

export function parseFinancialTrackerCsv(text: string): {
  revenue: TrackerRevenueRow[];
  expenses: TrackerExpenseRow[];
  warnings: string[];
} {
  const lines = splitLines(text).filter((l) => l.length > 0);
  const warnings: string[] = [];
  const revenue: TrackerRevenueRow[] = [];
  const expenses: TrackerExpenseRow[] = [];

  let mode: 'none' | 'revenue' | 'expenses' = 'none';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (upper.startsWith('REVENUE')) {
      mode = 'revenue';
      i++; // skip header next iteration loop will consume - actually next line is header
      continue;
    }
    if (upper.startsWith('EXPENSES')) {
      mode = 'expenses';
      i++;
      continue;
    }

    if (mode === 'revenue') {
      const cells = parseCsvLine(line);
      if (cells[0]?.trim().toLowerCase() === 'date') continue;
      if (cells.length < 5 || !cells[0]?.trim()) continue;

      const { iso, fixedTypo } = parseTrackerUsDate(cells[0]);
      if (fixedTypo) warnings.push(`Date typo fixed: ${fixedTypo}`);

      revenue.push({
        date_raw: cells[0],
        date_iso: iso,
        platform: (cells[1] ?? '').trim(),
        guest_name: (cells[2] ?? '').trim(),
        nights: parseMoneyLoose(cells[3]) != null ? Math.floor(Number(parseMoneyLoose(cells[3]))) : null,
        booking_amount: parseMoneyLoose(cells[4]),
        revenue: parseMoneyLoose(cells[5]),
        cleaning_fee: parseMoneyLoose(cells[6]),
        extra_charge: parseMoneyLoose(cells[7]),
        platform_charge: parseMoneyLoose(cells[8]),
        notes: (cells[9] ?? '').trim(),
      });
      continue;
    }

    if (mode === 'expenses') {
      const cells = parseCsvLine(line);
      if (cells[0]?.trim().toLowerCase() === 'date') continue;
      if (cells.length < 6) continue;
      if (isTotalRow(cells)) continue;
      if (!cells[0]?.trim() && !cells[1]?.trim()) continue;

      const dateCell = cells[0]?.trim() ?? '';
      if (!dateCell) continue;

      const { iso, fixedTypo } = parseTrackerUsDate(dateCell);
      if (fixedTypo && !warnings.some((w) => w.includes(fixedTypo))) warnings.push(`Date typo fixed: ${fixedTypo}`);

      const category = (cells[1] ?? '').trim();
      if (!category) continue;

      const amount = parseMoneyLoose(cells[5]);
      if (amount == null || amount <= 0) continue;

      const description = (cells[2] ?? '').trim();
      const vendor = (cells[3] ?? '').trim();
      const payment = (cells[6] ?? '').trim();

      expenses.push({
        date_raw: dateCell,
        date_iso: iso,
        category: category.replace(/\s+$/, ''),
        description,
        vendor,
        amount,
        payment_notes: payment,
      });
    }
  }

  return { revenue, expenses, warnings };
}

export function isDirectPlatform(platform: string): boolean {
  return /^direct\b/i.test(platform.trim());
}

/** Numbers tracker rows — platform column says "Airbnb" (not Direct). */
export function isAirbnbPlatform(platform: string): boolean {
  const p = platform.trim().toLowerCase();
  if (!p || isDirectPlatform(platform)) return false;
  return p.includes('airbnb');
}
