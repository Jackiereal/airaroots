import type { SupabaseClient } from '@supabase/supabase-js';
import { TemplateRepository } from '../repositories/template.repository';
import { CommunicationLogRepository } from '../repositories/communication-log.repository';
import { stubProvider } from '../providers/stub.provider';
import type { MessageProvider } from '../providers/types';
import { renderTemplate } from '../render';
import type { CommunicationTrigger, TemplateVars, Channel } from '../types';
import type { Reservation } from '../../reservation/types';

export class CommunicationService {
  private templates: TemplateRepository;
  private log: CommunicationLogRepository;

  constructor(private supabase: SupabaseClient, private provider: MessageProvider = stubProvider) {
    this.templates = new TemplateRepository(supabase);
    this.log = new CommunicationLogRepository(supabase);
  }

  // Fire the message for a lifecycle trigger. Idempotent per
  // (reservation, trigger). Always records a communication_log row —
  // including a 'skipped' row when there's no template or no contact info.
  async dispatch(trigger: CommunicationTrigger, reservation: Reservation): Promise<void> {
    if (await this.log.existsFor(reservation.id, trigger)) return;

    // Seed the org's default templates on first use.
    await this.templates.seedDefaults(reservation.organizationId);

    const template = await this.templates.findActive(reservation.organizationId, trigger);
    if (!template) {
      await this.record(reservation, trigger, 'whatsapp', null, null, 'skipped');
      return;
    }

    // Pick the recipient by the template's channel; skip if that contact
    // field isn't populated on the reservation.
    const recipient = this.recipientFor(template.channel, reservation);
    if (!recipient) {
      await this.record(reservation, trigger, template.channel, null, null, 'skipped');
      return;
    }

    const vars = await this.buildVars(reservation);
    const body = renderTemplate(template.body, vars);

    const result = await this.provider.send({
      channel: template.channel,
      recipient,
      subject: template.subject,
      body,
    });

    await this.record(
      reservation,
      trigger,
      template.channel,
      recipient,
      body,
      result.status,
      result.provider,
      result.error
    );
  }

  private recipientFor(channel: Channel, r: Reservation): string | null {
    if (channel === 'whatsapp') return r.guestPhone ?? null;
    return r.guestEmail ?? null;
  }

  private async buildVars(r: Reservation): Promise<TemplateVars> {
    const { data } = await this.supabase
      .from('properties')
      .select('name')
      .eq('id', r.propertyId)
      .maybeSingle();
    const propertyName = (data as { name?: string } | null)?.name ?? 'your property';

    return {
      guest_name: r.guestName ?? 'Guest',
      property_name: propertyName,
      check_in: r.checkIn,
      check_out: r.checkOut,
      nights: String(r.nights),
    };
  }

  private async record(
    r: Reservation,
    trigger: string,
    channel: string,
    recipient: string | null,
    body: string | null,
    status: 'stubbed' | 'sent' | 'failed' | 'skipped',
    provider: string | null = null,
    error: string | null = null
  ): Promise<void> {
    await this.log.insert({
      organizationId: r.organizationId,
      reservationId: r.id,
      propertyId: r.propertyId,
      trigger,
      channel,
      recipient,
      renderedBody: body,
      status,
      provider,
      error,
    });
  }
}
