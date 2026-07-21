import RuleList from './RuleList';

export const dynamic = 'force-dynamic';

export default function AutomationSettingsPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-fraunces)] text-[var(--text-primary)]">
          Automation rules
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          When something happens (a reservation is created, a guest checks in), the system can
          run actions automatically — create a housekeeping task, block the calendar, record
          revenue, notify your team. Turn each rule on or off below.
        </p>
      </div>
      <RuleList />
    </div>
  );
}
