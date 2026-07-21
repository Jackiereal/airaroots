import TemplateEditor from './TemplateEditor';

export const dynamic = 'force-dynamic';

export default function CommunicationSettingsPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-fraunces)] text-[var(--text-primary)]">
          Notification templates
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Customize the messages sent to housekeeping staff, vendors, and guests. Today these
          fill in the WhatsApp click-to-chat links your team taps to send. Connect your own
          WhatsApp/email provider later to deliver them automatically.
        </p>
      </div>
      <TemplateEditor />
    </div>
  );
}
