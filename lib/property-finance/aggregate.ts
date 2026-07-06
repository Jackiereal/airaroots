export type AirbnbImportRowNumbers = {
  row_type: string | null;
  amount: number | null;
  paid_out: number | null;
  service_fee: number | null;
  gross_earnings: number | null;
};

export function summarizeImportedAirbnbRows(rows: AirbnbImportRowNumbers[]) {
  let bankPayouts = 0;
  let taxWithholding = 0;
  let reservationCount = 0;
  let reservationHostAmount = 0;
  let serviceFeeSum = 0;
  let grossBookingSum = 0;

  for (const r of rows) {
    const t = r.row_type || '';
    if (t === 'Payout') {
      bankPayouts += Number(r.paid_out ?? 0);
    } else if (t.includes('Tax Withholding')) {
      taxWithholding += Number(r.amount ?? 0);
    } else if (t === 'Reservation') {
      reservationCount += 1;
      reservationHostAmount += Number(r.amount ?? 0);
      serviceFeeSum += Number(r.service_fee ?? 0);
      grossBookingSum += Number(r.gross_earnings ?? 0);
    }
  }

  return {
    bankPayouts,
    taxWithholding,
    reservationCount,
    reservationHostAmount,
    serviceFeeSum,
    grossBookingSum,
  };
}
