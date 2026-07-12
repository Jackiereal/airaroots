import TemplateEditor from './TemplateEditor';

export const dynamic = 'force-dynamic';

export default function CommunicationSettingsPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
          Guest messages
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Automated messages sent to guests across their stay. Sending is not connected yet —
          messages are logged for now and will go out once a WhatsApp/email provider is set up.
        </p>
      </div>
      <TemplateEditor />
    </div>
  );
}
