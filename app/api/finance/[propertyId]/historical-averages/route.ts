import { requireOrgRole } from '@/src/shared/utils/route-auth';

export type HistoricalAverages = {
  avgMonthlyRevenue: number;
  avgMonthlyExpenses: number;
  avgNightlyRate: number;
  avgOccupancyPct: number;
  totalMonthlyEmi: number;
  monthsAnalyzed: number;
  seasonality: Array<{
    month: string;
    calendarMonth: number;
    avgRevenue: number;
    avgNights: number;
    occupancy: number;
    adr: number;
    revpar: number;
    revenueMultiplier: number;
    avgOccupancyPct: number;
    dataPoints: number;
  }>;
};
import { summarizeImportedAirbnbRows } from '@/lib/property-finance/aggregate';
import { totalBookedNightsAirbnbReservations, totalBookedNightsDirect } from '@/lib/property-finance/booked-nights';
import { createServiceRoleClient, createServiceRoleClientLoose } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<boolean> {
  const db = createServiceRoleClientLoose();
  const { data } = await db.from('properties').select('organization_id').eq('id', propertyId).maybeSingle();
  return !!data && data.organization_id === organizationId;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { error: authError, ctx } = await requireOrgRole('viewer');
  if (authError) return authError;
  if (!(await assertPropertyInOrg(propertyId, ctx!.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = createServiceRoleClient();
  const [airRes, dirRes] = await Promise.all([
    db.from('property_finance_airbnb_rows').select('period_month, row_type, amount, paid_out, service_fee, gross_earnings, nights, start_date, end_date').eq('property_id', propertyId),
    db.from('property_finance_direct_bookings').select('period_month, amount, nights, check_in, check_out').eq('property_id', propertyId),
  ]);

  if (airRes.error) return NextResponse.json({ error: airRes.error.message }, { status: 500 });
  if (dirRes.error) return NextResponse.json({ error: dirRes.error.message }, { status: 500 });

  const airRows = airRes.data ?? [];
  const dirRows = dirRes.data ?? [];

  // Group by calendar month (0=Jan..11=Dec)
  const byMonth: Record<number, { revenueSum: number; nightsSum: number; count: number }> = {};
  for (let i = 0; i < 12; i++) byMonth[i] = { revenueSum: 0, nightsSum: 0, count: 0 };

  const allMonths = new Set([...airRows.map(r => r.period_month as string), ...dirRows.map(r => r.period_month as string)]);

  for (const pm of allMonths) {
    const calMonth = new Date(pm).getUTCMonth();
    const pmAir = airRows.filter(r => r.period_month === pm);
    const pmDir = dirRows.filter(r => r.period_month === pm);

    const airSum = summarizeImportedAirbnbRows(pmAir);
    const dirRevenue = pmDir.reduce((s, r) => s + Number(r.amount), 0);
    const airNights = totalBookedNightsAirbnbReservations(pmAir);
    const dirNights = totalBookedNightsDirect(pmDir);

    byMonth[calMonth].revenueSum += airSum.bankPayouts + airSum.taxWithholding + dirRevenue;
    byMonth[calMonth].nightsSum += airNights + dirNights;
    byMonth[calMonth].count += 1;
  }

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];

  const seasonality = monthNames.map((name, i) => {
    const d = byMonth[i];
    const avgRevenue = d.count > 0 ? d.revenueSum / d.count : 0;
    const avgNights = d.count > 0 ? d.nightsSum / d.count : 0;
    const totalDays = daysInMonth[i];
    const occupancy = totalDays > 0 ? (avgNights / totalDays) * 100 : 0;
    const adr = avgNights > 0 ? avgRevenue / avgNights : 0;
    const revpar = totalDays > 0 ? avgRevenue / totalDays : 0;
    return {
      month: name,
      calendarMonth: i,
      avgRevenue: Math.round(avgRevenue * 100) / 100,
      avgNights: Math.round(avgNights * 10) / 10,
      occupancy: Math.round(occupancy * 10) / 10,
      adr: Math.round(adr * 100) / 100,
      revpar: Math.round(revpar * 100) / 100,
      revenueMultiplier: 1,
      avgOccupancyPct: Math.round(occupancy * 10) / 10,
      dataPoints: d.count,
    };
  });

  const maxRevenue = Math.max(...seasonality.map(m => m.avgRevenue), 1);
  for (const m of seasonality) {
    m.revenueMultiplier = Math.round((m.avgRevenue / maxRevenue) * 100) / 100;
  }

  const monthsWithData = seasonality.filter(m => m.dataPoints > 0);
  const monthsAnalyzed = monthsWithData.length;
  const avgMonthlyRevenue = monthsAnalyzed > 0
    ? Math.round(monthsWithData.reduce((s, m) => s + m.avgRevenue, 0) / monthsAnalyzed)
    : 0;
  const avgNightlyRate = monthsAnalyzed > 0
    ? Math.round(monthsWithData.reduce((s, m) => s + m.adr, 0) / monthsAnalyzed)
    : 0;
  const avgOccupancyPct = monthsAnalyzed > 0
    ? Math.round(monthsWithData.reduce((s, m) => s + m.avgOccupancyPct, 0) / monthsAnalyzed * 10) / 10
    : 0;

  const result: HistoricalAverages = {
    avgMonthlyRevenue,
    avgMonthlyExpenses: 0,
    avgNightlyRate,
    avgOccupancyPct,
    totalMonthlyEmi: 0,
    monthsAnalyzed,
    seasonality,
  };

  return NextResponse.json(result);
}
