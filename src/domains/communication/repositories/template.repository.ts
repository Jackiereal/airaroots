import type { SupabaseClient } from '@supabase/supabase-js';
import type { CommunicationTemplate, CommunicationTrigger } from '../types';
import { DEFAULT_TEMPLATES, TRIGGERS } from '../constants';
import type { UpdateTemplateInput } from '../schema';

type TemplateRow = {
  id: string;
  organization_id: string;
  trigger: CommunicationTrigger;
  channel: 'whatsapp' | 'email';
  subject: string | null;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toEntity(r: TemplateRow): CommunicationTemplate {
  return {
    id: r.id,
    organizationId: r.organization_id,
    trigger: r.trigger,
    channel: r.channel,
    subject: r.subject,
    body: r.body,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class TemplateRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByOrg(organizationId: string): Promise<CommunicationTemplate[]> {
    const { data, error } = await this.supabase
      .from('communication_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('trigger', { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => toEntity(r as TemplateRow));
  }

  async findActive(
    organizationId: string,
    trigger: CommunicationTrigger
  ): Promise<CommunicationTemplate | null> {
    const { data, error } = await this.supabase
      .from('communication_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('trigger', trigger)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    return data ? toEntity(data as TemplateRow) : null;
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateTemplateInput
  ): Promise<CommunicationTemplate | null> {
    const patch: Record<string, unknown> = {};
    if (input.subject !== undefined) patch['subject'] = input.subject;
    if (input.body !== undefined) patch['body'] = input.body;
    if (input.isActive !== undefined) patch['is_active'] = input.isActive;

    const { data, error } = await this.supabase
      .from('communication_templates')
      .update(patch)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    return data ? toEntity(data as TemplateRow) : null;
  }

  // Idempotently create the 3 default templates for an org. Safe to call
  // repeatedly — the unique (org, trigger, channel) constraint + ignore
  // means only missing rows are inserted.
  async seedDefaults(organizationId: string): Promise<void> {
    const rows = TRIGGERS.map((trigger) => ({
      organization_id: organizationId,
      trigger,
      channel: DEFAULT_TEMPLATES[trigger].channel,
      subject: DEFAULT_TEMPLATES[trigger].subject,
      body: DEFAULT_TEMPLATES[trigger].body,
    }));

    const { error } = await this.supabase
      .from('communication_templates')
      .upsert(rows, { onConflict: 'organization_id,trigger,channel', ignoreDuplicates: true });

    if (error) throw new Error(`DB error: ${error.message}`);
  }
}
