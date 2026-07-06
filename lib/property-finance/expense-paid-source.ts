// Generalized: owner_id (UUID) replaces hardcoded 'teja'|'indu'

export type PaidFrom = 'self' | 'out_of_pocket';

export function resolveExpensePaidSource(args: {
  paid_from?: string | null;
  owner_id?: string | null;
  defaultPaidFrom?: PaidFrom;
}):
  | { ok: true; paid_from: PaidFrom; owner_id: string | null }
  | { ok: false; error: string } {
  const rawFrom = (args.paid_from ?? args.defaultPaidFrom ?? 'self').toString().trim();
  if (rawFrom !== 'self' && rawFrom !== 'out_of_pocket') {
    return { ok: false, error: 'paid_from must be self or out_of_pocket' };
  }

  const paid_from = rawFrom as PaidFrom;

  if (paid_from === 'self') {
    if (args.owner_id) {
      return { ok: false, error: 'owner_id must be empty when paid_from is self' };
    }
    return { ok: true, paid_from: 'self', owner_id: null };
  }

  if (!args.owner_id) {
    return { ok: false, error: 'Out-of-pocket expenses must specify owner_id' };
  }

  return { ok: true, paid_from: 'out_of_pocket', owner_id: args.owner_id };
}

export function formatExpensePaidLabel(
  paid_from: string | null | undefined,
  ownerName: string | null | undefined
): string {
  if (paid_from === 'out_of_pocket') {
    return ownerName ? `Out of pocket · ${ownerName}` : 'Out of pocket';
  }
  return 'Self';
}

export type OutOfPocketTotals = Record<string, number>;

/** Sum amounts per owner_id for out-of-pocket rows. */
export function sumOutOfPocketByOwner(
  rows: ReadonlyArray<{ paid_from?: string | null; owner_id?: string | null; amount: unknown }>
): OutOfPocketTotals {
  const totals: OutOfPocketTotals = {};
  for (const r of rows) {
    if (r.paid_from !== 'out_of_pocket' || !r.owner_id) continue;
    const a = Number(r.amount);
    if (!Number.isFinite(a)) continue;
    totals[r.owner_id] = (totals[r.owner_id] ?? 0) + a;
  }
  for (const k of Object.keys(totals)) {
    totals[k] = Math.round(totals[k] * 100) / 100;
  }
  return totals;
}
