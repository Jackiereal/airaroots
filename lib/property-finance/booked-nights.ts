/**
 * Booked stay length for direct stays and Airbnb reservation rows.
 * Prefers stored nights; otherwise checkout − check-in (calendar days).
 */

export function nightsFromStay(args: {
  nights: number | null | undefined;
  start: string | null | undefined;
  end: string | null | undefined;
}): number {
  const n = args.nights;
  if (n != null && Number.isFinite(Number(n)) && Number(n) >= 0) return Math.round(Number(n));
  if (args.start && args.end) {
    const a = new Date(args.start);
    const b = new Date(args.end);
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
      const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000);
      if (diff >= 0) return diff;
    }
  }
  return 0;
}

export function totalBookedNightsDirect(
  rows: Array<{ nights: number | null; check_in: string | null; check_out: string | null }>,
): number {
  return rows.reduce(
    (s, r) => s + nightsFromStay({ nights: r.nights, start: r.check_in, end: r.check_out }),
    0,
  );
}

export function totalBookedNightsAirbnbReservations(
  rows: Array<{ row_type: string | null; nights: number | null; start_date: string | null; end_date: string | null }>,
): number {
  return rows
    .filter((r) => r.row_type === 'Reservation')
    .reduce(
      (s, r) => s + nightsFromStay({ nights: r.nights, start: r.start_date, end: r.end_date }),
      0,
    );
}
