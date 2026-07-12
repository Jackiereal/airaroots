import type { ProviderAdapter, OutboundMessage, SendResult } from './types';

// Phase-1 WhatsApp path — no API, no cost, no org credentials. Rather than
// "sending", it produces a wa.me click-to-chat link with the message
// pre-filled; a manager taps it to open WhatsApp and send from their own
// number. This is the free BYOP-friendly default until an org connects a
// real WhatsApp Business provider (Meta Cloud API / Twilio / etc.).
export class WaLinkAdapter implements ProviderAdapter {
  readonly providerType = 'wa_link';

  async send(msg: OutboundMessage): Promise<SendResult> {
    const phone = msg.recipient.replace(/\D/g, '');
    if (!phone) {
      return { deliveryStatus: 'skipped', providerType: this.providerType, error: 'no phone' };
    }
    const link = `https://wa.me/${phone}?text=${encodeURIComponent(msg.body)}`;
    return { deliveryStatus: 'link_generated', providerType: this.providerType, link };
  }
}

export const waLinkAdapter = new WaLinkAdapter();
