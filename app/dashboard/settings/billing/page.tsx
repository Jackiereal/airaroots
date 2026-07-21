import BillingPanel from './BillingPanel';

export const dynamic = 'force-dynamic';

export default function BillingSettingsPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-fraunces)] text-[var(--text-primary)]">
          Billing
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          View your current plan, manage your subscription, or upgrade for more properties.
        </p>
      </div>
      <BillingPanel />
    </div>
  );
}
