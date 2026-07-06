/** Infer party size from Airbnb CSV raw cells when present; otherwise 1 per reservation. */

export function guestCountFromAirbnbRaw(raw: unknown): number {
  if (raw == null || typeof raw !== 'object') return 1;
  const r = raw as Record<string, string>;
  const tryKeys = ['Number of guests', 'Guests', 'Guest count', 'Number Of Guests', 'number of guests'];
  for (const k of tryKeys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) {
      const n = Number.parseInt(v.replace(/,/g, '').trim(), 10);
      if (Number.isFinite(n) && n >= 1) return Math.min(n, 99);
    }
  }
  return 1;
}

export type AirbnbReservationGuestRow = {
  raw: unknown;
  guest_count?: number | null;
};

/** Uses DB `guest_count` when set; otherwise infers from CSV raw (same rules as import). */
export function effectiveGuestCountForAirbnbReservation(row: AirbnbReservationGuestRow): number {
  const g = row.guest_count;
  if (g != null && Number.isFinite(Number(g))) {
    const n = Math.floor(Number(g));
    if (n >= 1) return Math.min(n, 99);
  }
  return guestCountFromAirbnbRaw(row.raw);
}

export function sumDirectGuestCounts(rows: Array<{ guest_count: number | null }>): number {
  let s = 0;
  for (const row of rows) {
    const g = row.guest_count;
    s += g != null && g >= 1 ? g : 1;
  }
  return s;
}

export function sumAirbnbReservationGuests(rows: AirbnbReservationGuestRow[]): number {
  let s = 0;
  for (const row of rows) {
    s += effectiveGuestCountForAirbnbReservation(row);
  }
  return s;
}
