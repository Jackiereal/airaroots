import type { ProviderAdapter, OutboundMessage, SendResult } from './types';

// Email delivery is stubbed until an org connects an email provider (SMTP /
// Resend) under BYOP. Reports 'stubbed' so the attempt is logged without any
// network call. Swap the body of send() for a real client once credentials
// exist — no change to the Notification Service.
export class EmailAdapter implements ProviderAdapter {
  readonly providerType = 'email_stub';

  async send(_msg: OutboundMessage): Promise<SendResult> {
    return { deliveryStatus: 'stubbed', providerType: this.providerType };
  }
}

export const emailAdapter = new EmailAdapter();
