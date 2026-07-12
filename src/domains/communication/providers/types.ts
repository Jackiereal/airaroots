import type { Channel, CommunicationStatus } from '../types';

export type OutboundMessage = {
  channel: Channel;
  recipient: string;
  subject?: string | null;
  body: string;
};

export type SendResult = {
  status: CommunicationStatus;
  provider: string | null;
  error?: string | null;
};

// A pluggable send backend. The stub logs only; real WhatsApp/email
// providers implement this same interface with no changes upstream.
export interface MessageProvider {
  send(msg: OutboundMessage): Promise<SendResult>;
}
