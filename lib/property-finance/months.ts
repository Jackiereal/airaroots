/** Returns ISO date strings YYYY-MM-01 for the last `n` calendar months (UTC), oldest first. */
export function lastNMonthStartsUtc(n: number): string[] {
  const count = Math.min(36, Math.max(1, Math.floor(n)));
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(12, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    out.push(`${y}-${String(m).padStart(2, '0')}-01`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out.reverse();
}
