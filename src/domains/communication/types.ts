export type CommunicationTrigger =
  | 'booking_confirmation'
  | 'checkin_welcome'
  | 'checkout_thankyou';

export type Channel = 'whatsapp' | 'email';

export type CommunicationStatus = 'stubbed' | 'sent' | 'failed' | 'skipped';

export type CommunicationTemplate = {
  id: string;
  organizationId: string;
  trigger: CommunicationTrigger;
  channel: Channel;
  subject: string | null;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationLogEntry = {
  id: string;
  organizationId: string;
  reservationId: string;
  propertyId: string | null;
  trigger: string;
  channel: string;
  recipient: string | null;
  renderedBody: string | null;
  status: CommunicationStatus;
  provider: string | null;
  error: string | null;
  createdAt: string;
};

// Variables available to templates via {{key}} placeholders.
export type TemplateVars = Record<string, string>;
