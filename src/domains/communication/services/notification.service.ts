import type { SupabaseClient } from '@supabase/supabase-js';
import { TemplateRepository } from '../repositories/template.repository';
import { NotificationLogRepository } from '../repositories/notification-log.repository';
import { getAdapter } from '../providers/registry';
import { renderTemplate } from '../render';
import type { NotificationTrigger, TemplateVars, Channel } from '../types';

export type NotificationRequest = {
  organizationId: string;
  trigger: NotificationTrigger;
  channel: Channel;
  recipient: string | null;
  vars: TemplateVars;
  context?: Record<string, unknown>;
};

export type NotificationResult = {
  deliveryStatus: string;
  link?: string | null;
  renderedBody?: string | null;
};

// Provider-agnostic notification dispatch. Resolves the org's template →
// renders → resolves the org's provider adapter for the channel → delivers →
// logs the attempt. Holds ZERO provider-specific logic (only the registry).
// Airaroots queues/executes; the org's own provider delivers (BYOP).
export class NotificationService {
  private templates: TemplateRepository;
  private log: NotificationLogRepository;

  constructor(private supabase: SupabaseClient) {
    this.templates = new TemplateRepository(supabase);
    this.log = new NotificationLogRepository(supabase);
  }

  async notify(req: NotificationRequest): Promise<NotificationResult> {
    await this.templates.seedDefaults(req.organizationId);

    const template = await this.templates.findActive(req.organizationId, req.trigger);
    if (!template) {
      await this.record(req, null, null, null, 'skipped');
      return { deliveryStatus: 'skipped' };
    }

    if (!req.recipient) {
      await this.record(req, template.channel, null, null, 'skipped');
      return { deliveryStatus: 'skipped' };
    }

    const body = renderTemplate(template.body, req.vars);
    const adapter = await getAdapter(this.supabase, req.organizationId, template.channel);
    if (!adapter) {
      await this.record(req, template.channel, null, body, 'skipped', 'no adapter for channel');
      return { deliveryStatus: 'skipped', renderedBody: body };
    }

    const result = await adapter.send({
      channel: template.channel,
      recipient: req.recipient,
      subject: template.subject,
      body,
    });

    await this.log.insert({
      organizationId: req.organizationId,
      trigger: req.trigger,
      channel: template.channel,
      recipient: req.recipient,
      renderedBody: body,
      providerType: result.providerType,
      deliveryStatus: result.deliveryStatus,
      link: result.link,
      error: result.error,
      context: req.context,
    });

    return { deliveryStatus: result.deliveryStatus, link: result.link, renderedBody: body };
  }

  private async record(
    req: NotificationRequest,
    channel: string | null,
    recipient: string | null,
    body: string | null,
    status: 'skipped',
    error?: string
  ): Promise<void> {
    await this.log.insert({
      organizationId: req.organizationId,
      trigger: req.trigger,
      channel: channel ?? req.channel,
      recipient,
      renderedBody: body,
      providerType: null,
      deliveryStatus: status,
      error: error ?? null,
      context: req.context,
    });
  }
}
