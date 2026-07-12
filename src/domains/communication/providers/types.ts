import type { Channel, DeliveryStatus } from '../types';

export type OutboundMessage = {
  channel: Channel;
  recipient: string;
  subject?: string | null;
  body: string;
};

export type SendResult = {
  deliveryStatus: DeliveryStatus;
  providerType: string | null;
  link?: string | null;   // wa.me click-to-chat URL, for link-based adapters
  error?: string | null;
};

// Provider Adapter — the single seam between the Notification Service and any
// delivery backend. The service holds zero provider-specific logic; adding a
// provider (Meta Cloud API, Twilio, SMTP, …) means a new class implementing
// this interface, no business-logic change. BYOP: real adapters read the
// org's own (encrypted) credentials.
export interface ProviderAdapter {
  readonly providerType: string;
  send(msg: OutboundMessage): Promise<SendResult>;
}
