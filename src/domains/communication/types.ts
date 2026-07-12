export type NotificationTrigger =
  | 'housekeeping_assignment'
  | 'housekeeping_reminder'
  | 'vendor_dispatch'
  | 'reservation_confirmed'
  | 'checkout_thankyou';

export type Channel = 'whatsapp' | 'email' | 'sms' | 'push';

export type DeliveryStatus =
  | 'queued'
  | 'link_generated'
  | 'sent'
  | 'failed'
  | 'stubbed'
  | 'skipped';

export type CommunicationTemplate = {
  id: string;
  organizationId: string;
  trigger: NotificationTrigger;
  channel: Channel;
  subject: string | null;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationLogEntry = {
  id: string;
  organizationId: string;
  trigger: string;
  channel: string;
  recipient: string | null;
  renderedBody: string | null;
  providerType: string | null;
  deliveryStatus: DeliveryStatus;
  link: string | null;
  error: string | null;
  context: Record<string, unknown>;
  attempts: number;
  createdAt: string;
};

// Variables available to templates via {{key}} placeholders.
export type TemplateVars = Record<string, string>;
