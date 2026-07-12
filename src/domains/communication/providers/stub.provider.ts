import type { MessageProvider, OutboundMessage, SendResult } from './types';

// No external provider is wired yet (no WhatsApp Business API / Resend
// account). This "sends" nothing — it just reports 'stubbed' so the
// dispatch is recorded in communication_log without any network call.
// Swap for a real provider (behind the same MessageProvider interface)
// once credentials exist.
export class StubProvider implements MessageProvider {
  async send(_msg: OutboundMessage): Promise<SendResult> {
    return { status: 'stubbed', provider: null };
  }
}

export const stubProvider = new StubProvider();
