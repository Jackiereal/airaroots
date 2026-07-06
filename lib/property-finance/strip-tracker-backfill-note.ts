/**
 * Removes prefixes written by `scripts/backfill-financial-tracker.ts` so notes stay human-readable.
 * Safe to call on already-clean strings (no-op).
 */
export function stripFinancialTrackerBackfillFromNote(notes: string | null | undefined): string | null {
  if (notes == null) return null;
  let s = notes.trim();
  if (s === '') return null;

  // Expense form: "[tracker-backfill March 2026-Table 1.csv] | Vijaya Kumari | …"
  s = s.replace(/^\[tracker-backfill[^\]]*\]\s*\|\s*/u, '');

  // Direct booking form: "[tracker-backfill] March 2026-Table 1.csv · … · Revenue ₹…"
  s = s.replace(/^\[tracker-backfill\]\s+[^·]+\s*·\s*/u, '');

  // Row was only "[tracker-backfill] filename.csv" (no middle-dot tail)
  s = s.replace(/^\[tracker-backfill\]\s+[\s\S]+$/u, '');

  s = s.trim();
  return s === '' ? null : s;
}
