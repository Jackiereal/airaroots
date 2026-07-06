export type AmortizationRow = {
  month: number;
  date: string;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  extraPayment: number;
  closingBalance: number;
};

export type LoanSchedule = {
  emi: number;
  totalPayable: number;
  totalInterest: number;
  debtFreeDate: string;
  rows: AmortizationRow[];
};

export function calcEmi(principal: number, annualRate: number, tenureMonths: number): number {
  if (annualRate === 0) return principal / tenureMonths;
  const r = annualRate / 12 / 100;
  return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
}

export function buildSchedule(params: {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  startDate: string;
  emiOverride?: number | null;
  extraPayments?: { payment_date: string; amount: number; payment_type: string }[];
}): LoanSchedule {
  const { principal, annualRate, tenureMonths, startDate, emiOverride, extraPayments = [] } = params;
  const r = annualRate / 12 / 100;
  const emi = emiOverride ?? calcEmi(principal, annualRate, tenureMonths);

  const extraByMonth: Record<string, number> = {};
  for (const p of extraPayments) {
    if (p.payment_type === 'extra' || p.payment_type === 'prepayment') {
      const key = p.payment_date.slice(0, 7);
      extraByMonth[key] = (extraByMonth[key] ?? 0) + p.amount;
    }
  }

  const rows: AmortizationRow[] = [];
  let balance = principal;
  let month = 1;
  const start = new Date(startDate);

  while (balance > 0.5 && month <= tenureMonths + 120) {
    const date = new Date(start);
    date.setMonth(start.getMonth() + month - 1);
    const dateStr = date.toISOString().slice(0, 10);
    const monthKey = dateStr.slice(0, 7);

    const interestForMonth = balance * r;
    const principalForMonth = Math.min(emi - interestForMonth, balance);
    const extraPayment = extraByMonth[monthKey] ?? 0;
    const closingBalance = Math.max(0, balance - principalForMonth - extraPayment);

    rows.push({
      month,
      date: dateStr,
      openingBalance: Math.round(balance * 100) / 100,
      emi: Math.round(emi * 100) / 100,
      principal: Math.round(principalForMonth * 100) / 100,
      interest: Math.round(interestForMonth * 100) / 100,
      extraPayment: Math.round(extraPayment * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
    });

    balance = closingBalance;
    month++;
  }

  const lastRow = rows[rows.length - 1];
  const totalPaid = rows.reduce((s, r) => s + r.emi + r.extraPayment, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);

  return {
    emi: Math.round(emi * 100) / 100,
    totalPayable: Math.round(totalPaid * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    debtFreeDate: lastRow?.date ?? startDate,
    rows,
  };
}

export function loanSummaryFromSchedule(
  schedule: LoanSchedule,
  payments: { payment_date: string; amount: number; payment_type: string }[],
  _startDate: string
) {
  const today = new Date().toISOString().slice(0, 10);
  const paidEmiMonths = payments.filter((p) => p.payment_type === 'emi' && p.payment_date <= today);
  const extraPaid = payments
    .filter((p) => (p.payment_type === 'extra' || p.payment_type === 'prepayment') && p.payment_date <= today)
    .reduce((s, p) => s + p.amount, 0);

  const paidMonths = paidEmiMonths.length;
  const rowNow = schedule.rows[paidMonths] ?? schedule.rows[schedule.rows.length - 1];
  const outstandingPrincipal = rowNow?.openingBalance ?? 0;

  const interestPaid = schedule.rows.slice(0, paidMonths).reduce((s, r) => s + r.interest, 0);
  const principalPaid = schedule.rows.slice(0, paidMonths).reduce((s, r) => s + r.principal, 0) + extraPaid;
  const remainingInterest = schedule.rows.slice(paidMonths).reduce((s, r) => s + r.interest, 0);

  return {
    emi: schedule.emi,
    outstandingPrincipal: Math.round(outstandingPrincipal * 100) / 100,
    principalPaid: Math.round(principalPaid * 100) / 100,
    interestPaid: Math.round(interestPaid * 100) / 100,
    remainingInterest: Math.round(remainingInterest * 100) / 100,
    totalInterest: schedule.totalInterest,
    debtFreeDate: schedule.debtFreeDate,
  };
}
