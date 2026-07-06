'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, TrendingUp, Building2, Landmark, BarChart3, Wallet, MapPin, Save } from 'lucide-react';

type HistoricalAverages = {
  avgMonthlyRevenue: number;
  avgMonthlyExpenses: number;
  totalMonthlyEmi: number;
  monthsAnalyzed: number;
};

type Loan = {
  id: string;
  principal: number;
  interest_rate: number;
  tenure_months: number;
  emi_override: number | null;
  is_active: boolean;
  computed_emi: number;
};

type ValuationInputs = {
  revenueMultiple: number;
  ebitdaMultiple: number;
  discountRate: number;
  growthRate: number;
  projectionYears: number;
};

type PropertyInputs = {
  landAreaCents: number;
  ratePerCent: number;
  constructionValue: number;
};

const VALUATION_DEFAULTS: ValuationInputs = {
  revenueMultiple: 3,
  ebitdaMultiple: 5,
  discountRate: 12,
  growthRate: 8,
  projectionYears: 10,
};

const PROPERTY_DEFAULTS: PropertyInputs = {
  landAreaCents: 38,
  ratePerCent: 0,
  constructionValue: 0,
};

function fmt(n: number) {
  const abs = Math.abs(n);
  if (abs >= 10000000) return (n < 0 ? '-' : '') + '₹' + (abs / 10000000).toFixed(2) + ' Cr';
  if (abs >= 100000) return (n < 0 ? '-' : '') + '₹' + (abs / 100000).toFixed(2) + ' L';
  return (n < 0 ? '-' : '') + '₹' + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function calcDCF(annualCF: number, growthRate: number, discountRate: number, years: number): number {
  if (annualCF <= 0) return 0;
  const g = growthRate / 100;
  const r = discountRate / 100;
  let npv = 0;
  for (let t = 1; t <= years; t++) {
    npv += (annualCF * Math.pow(1 + g, t)) / Math.pow(1 + r, t);
  }
  if (r > g) {
    const terminalCF = annualCF * Math.pow(1 + g, years + 1);
    npv += terminalCF / (r - g) / Math.pow(1 + r, years);
  }
  return Math.round(npv);
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  displayFn,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayFn: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
        <span>{label}</span>
        <span className="font-semibold text-[var(--text-primary)]">{displayFn(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
      <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-0.5">
        <span>{displayFn(min)}</span>
        <span>{displayFn(max)}</span>
      </div>
    </div>
  );
}

function ValuationCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
  size = 'normal',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  size?: 'normal' | 'large';
}) {
  return (
    <div
      className={`rounded-xl border p-4 space-y-1 ${
        highlight
          ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10'
          : 'border-[var(--border-color)] bg-[var(--bg-surface)]'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${highlight ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`} />
        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      </div>
      <p className={`font-bold ${size === 'large' ? 'text-2xl' : 'text-xl'} ${highlight ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-[var(--text-secondary)]">{sub}</p>}
    </div>
  );
}

function NumberInput({
  label,
  value,
  prefix,
  suffix,
  placeholder,
  onChange,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      <div className="flex items-center gap-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] overflow-hidden focus-within:border-[var(--accent)]/60">
        {prefix && (
          <span className="px-2 text-xs text-[var(--text-secondary)] border-r border-[var(--border-color)] bg-[var(--bg-surface)] self-stretch flex items-center">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min={0}
          value={value || ''}
          placeholder={placeholder ?? '0'}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] outline-none min-w-0"
        />
        {suffix && (
          <span className="px-2 text-xs text-[var(--text-secondary)] border-l border-[var(--border-color)] bg-[var(--bg-surface)] self-stretch flex items-center">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BusinessValuation({ propertyId }: { propertyId: string }) {
  const [hist, setHist] = useState<HistoricalAverages | null>(null);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [initialInvestment, setInitialInvestment] = useState(0);
  const [inputs, setInputs] = useState<ValuationInputs>(VALUATION_DEFAULTS);
  const [property, setProperty] = useState<PropertyInputs>(PROPERTY_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/airbnb-finance/historical-averages').then((r) => r.json()),
      fetch('/api/finance/${propertyId}/loans').then((r) => r.json()),
      fetch('/api/finance/${propertyId}/projections-config').then((r) => r.json()),
    ])
      .then(([histData, loansData, cfgData]) => {
        setHist(histData as HistoricalAverages);

        const activeLoans = ((loansData as { loans: Loan[] }).loans ?? []).filter((l) => l.is_active);
        setTotalOutstanding(activeLoans.reduce((s, l) => s + l.principal, 0));

        const cfg = (cfgData as { config: Record<string, unknown> }).config ?? {};
        const bi = cfg.breakeven_inputs as { initialInvestment?: number } | undefined;
        setInitialInvestment(bi?.initialInvestment ?? 0);

        const saved = cfg.property_inputs as Partial<PropertyInputs> | undefined;
        if (saved) {
          setProperty({
            landAreaCents: saved.landAreaCents ?? 38,
            ratePerCent: saved.ratePerCent ?? 0,
            constructionValue: saved.constructionValue ?? 0,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-save property inputs with debounce
  function updateProperty(patch: Partial<PropertyInputs>) {
    const next = { ...property, ...patch };
    setProperty(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fetch('/api/finance/${propertyId}/projections-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'property_inputs', value: next }),
      });
      setSaving(false);
    }, 800);
  }

  const calc = useMemo(() => {
    if (!hist) return null;
    const annualRevenue = hist.avgMonthlyRevenue * 12;
    const annualOpEx = hist.avgMonthlyExpenses * 12;
    const annualEmi = hist.totalMonthlyEmi * 12;
    const ebitda = annualRevenue - annualOpEx;
    const netAnnualCF = ebitda - annualEmi;

    const revenueValue = Math.round(annualRevenue * inputs.revenueMultiple);
    const ebitdaValue = ebitda > 0 ? Math.round(ebitda * inputs.ebitdaMultiple) : 0;
    const dcfValue = calcDCF(netAnnualCF, inputs.growthRate, inputs.discountRate, inputs.projectionYears);

    const validMethods = [revenueValue, ebitdaValue || revenueValue, dcfValue > 0 ? dcfValue : revenueValue];
    const avgEnterpriseValue = Math.round(validMethods.reduce((s, v) => s + v, 0) / validMethods.length);

    const landValue = Math.round(property.landAreaCents * property.ratePerCent);
    const totalAssets = landValue + property.constructionValue;
    const netWorth = avgEnterpriseValue + totalAssets - totalOutstanding;

    return {
      annualRevenue,
      annualOpEx,
      annualEmi,
      ebitda,
      netAnnualCF,
      revenueValue,
      ebitdaValue,
      dcfValue,
      avgEnterpriseValue,
      landValue,
      totalAssets,
      netWorth,
    };
  }, [hist, inputs, totalOutstanding, property]);

  const setVal = (key: keyof ValuationInputs) => (v: number) => setInputs((p) => ({ ...p, [key]: v }));

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading financial data…
      </div>
    );
  }

  if (!hist || hist.monthsAnalyzed === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          No financial data yet. Add Airbnb/booking records first to calculate valuation.
        </p>
      </div>
    );
  }

  const hasPropertyData = calc!.landValue > 0 || property.constructionValue > 0;

  return (
    <div className="space-y-6">
      <p className="text-xs text-[var(--text-secondary)]">
        Based on {hist.monthsAnalyzed} months of data · Avg monthly revenue{' '}
        <span className="text-[var(--text-primary)] font-medium">{fmt(hist.avgMonthlyRevenue)}</span>
      </p>

      {/* Key financials */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        {[
          { label: 'Annual Revenue', value: fmt(calc!.annualRevenue) },
          { label: 'Annual EBITDA', value: fmt(calc!.ebitda) },
          { label: 'Annual Net CF', value: fmt(calc!.netAnnualCF) },
          { label: 'Total Debt', value: fmt(totalOutstanding) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3">
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">{label}</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Property inputs */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Property &amp; Land (Villapilsala, Trivandrum)
          </p>
          {saving && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
              <Save className="h-3 w-3 animate-pulse" /> Saving…
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberInput
            label="Land Area"
            value={property.landAreaCents}
            suffix="cents"
            placeholder="38"
            onChange={(v) => updateProperty({ landAreaCents: v })}
          />
          <NumberInput
            label="Market Rate per Cent"
            value={property.ratePerCent}
            prefix="₹"
            placeholder="e.g. 400000"
            onChange={(v) => updateProperty({ ratePerCent: v })}
          />
          <NumberInput
            label="Construction / Building Value"
            value={property.constructionValue}
            prefix="₹"
            placeholder="e.g. 5000000"
            onChange={(v) => updateProperty({ constructionValue: v })}
          />
        </div>
        {property.ratePerCent > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] p-3 text-center">
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">Land Value</p>
              <p className="text-base font-bold text-[var(--text-primary)]">{fmt(calc!.landValue)}</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{property.landAreaCents} cents × {fmt(property.ratePerCent)}/cent</p>
            </div>
            {property.constructionValue > 0 && (
              <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] p-3 text-center">
                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">Construction Value</p>
                <p className="text-base font-bold text-[var(--text-primary)]">{fmt(property.constructionValue)}</p>
              </div>
            )}
            <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] p-3 text-center">
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">Total Asset Value</p>
              <p className="text-base font-bold text-[var(--text-primary)]">{fmt(calc!.totalAssets)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Business valuation methods */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ValuationCard
          icon={TrendingUp}
          label={`Revenue Multiple (${inputs.revenueMultiple}x)`}
          value={fmt(calc!.revenueValue)}
          sub="Annual revenue × multiple"
        />
        <ValuationCard
          icon={BarChart3}
          label={`EBITDA Multiple (${inputs.ebitdaMultiple}x)`}
          value={calc!.ebitdaValue > 0 ? fmt(calc!.ebitdaValue) : 'N/A (negative EBITDA)'}
          sub="EBITDA × multiple"
        />
        <ValuationCard
          icon={Landmark}
          label={`DCF (${inputs.projectionYears}yr, ${inputs.growthRate}% growth)`}
          value={calc!.dcfValue > 0 ? fmt(calc!.dcfValue) : 'N/A (negative cash flow)'}
          sub={`Discounted at ${inputs.discountRate}% rate`}
        />
      </div>

      {/* Net worth */}
      <div className={`grid grid-cols-1 gap-3 ${hasPropertyData ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <ValuationCard
          icon={Building2}
          label="Avg Business Value"
          value={fmt(calc!.avgEnterpriseValue)}
          sub="Average of all 3 methods"
        />
        {hasPropertyData && (
          <ValuationCard
            icon={MapPin}
            label="Total Property Assets"
            value={fmt(calc!.totalAssets)}
            sub="Land + construction"
          />
        )}
        <ValuationCard
          icon={Wallet}
          label="Net Worth"
          value={fmt(calc!.netWorth)}
          sub={
            hasPropertyData
              ? 'Business + property assets − debt'
              : 'Business value − debt'
          }
          highlight
          size="large"
        />
      </div>

      {initialInvestment > 0 && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">
            Return on initial investment ({fmt(initialInvestment)})
          </span>
          <span className="text-sm font-bold text-[var(--accent)]">
            {((calc!.netWorth / initialInvestment) * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {/* Sliders */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-4">
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">Business Valuation Assumptions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SliderRow
            label="Revenue Multiple"
            value={inputs.revenueMultiple}
            min={1}
            max={10}
            step={0.5}
            displayFn={(v) => `${v}x`}
            onChange={setVal('revenueMultiple')}
          />
          <SliderRow
            label="EBITDA Multiple"
            value={inputs.ebitdaMultiple}
            min={2}
            max={15}
            step={0.5}
            displayFn={(v) => `${v}x`}
            onChange={setVal('ebitdaMultiple')}
          />
          <SliderRow
            label="Annual Growth Rate"
            value={inputs.growthRate}
            min={0}
            max={30}
            step={1}
            displayFn={(v) => `${v}%`}
            onChange={setVal('growthRate')}
          />
          <SliderRow
            label="Discount Rate (hurdle)"
            value={inputs.discountRate}
            min={5}
            max={25}
            step={1}
            displayFn={(v) => `${v}%`}
            onChange={setVal('discountRate')}
          />
          <SliderRow
            label="Projection Years (DCF)"
            value={inputs.projectionYears}
            min={5}
            max={20}
            step={1}
            displayFn={(v) => `${v} yrs`}
            onChange={setVal('projectionYears')}
          />
        </div>
        <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-secondary)] leading-relaxed">
          <strong className="text-[var(--text-primary)]">Benchmarks:</strong> STR revenue multiples 1.5–4×. EBITDA multiples 4–8× for hospitality. Discount rate 10–15% India real estate. Growth 5–12% mature STR markets.
        </div>
      </div>
    </div>
  );
}
