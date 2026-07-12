import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AutomationRule,
  AutomationTrigger,
  Condition,
  Action,
  RunLogEntry,
  RunStatus,
} from '../types';
import type { UpdateRuleInput } from '../schema';
import { DEFAULT_RULES } from '../constants';

// New tables (automation_rules, automation_run_log) aren't in the hand-written
// DB types stub, so reads/writes go through the loose client and rows are cast
// through `unknown`.

type RuleRow = {
  id: string;
  organization_id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: Condition[];
  actions: Action[];
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

function toRule(r: RuleRow): AutomationRule {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    trigger: r.trigger,
    conditions: r.conditions ?? [],
    actions: r.actions ?? [],
    isActive: r.is_active,
    isSystem: r.is_system,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class AutomationRuleRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByOrg(organizationId: string): Promise<AutomationRule[]> {
    const { data, error } = await this.supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .order('trigger', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);
    return ((data ?? []) as unknown as RuleRow[]).map(toRule);
  }

  async findActive(
    organizationId: string,
    trigger: AutomationTrigger
  ): Promise<AutomationRule[]> {
    const { data, error } = await this.supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('trigger', trigger)
      .eq('is_active', true);

    if (error) throw new Error(`DB error: ${error.message}`);
    return ((data ?? []) as unknown as RuleRow[]).map(toRule);
  }

  async findById(organizationId: string, id: string): Promise<AutomationRule | null> {
    const { data, error } = await this.supabase
      .from('automation_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    return data ? toRule(data as unknown as RuleRow) : null;
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateRuleInput
  ): Promise<AutomationRule | null> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch['name'] = input.name;
    if (input.isActive !== undefined) patch['is_active'] = input.isActive;

    const { data, error } = await this.supabase
      .from('automation_rules')
      .update(patch)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    return data ? toRule(data as unknown as RuleRow) : null;
  }

  // Returns false if the rule doesn't exist for this org or is a system rule
  // (system rules are protected — re-created by seedDefaults anyway).
  async deleteCustom(organizationId: string, id: string): Promise<boolean> {
    const existing = await this.findById(organizationId, id);
    if (!existing || existing.isSystem) return false;

    const { error } = await this.supabase
      .from('automation_rules')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) throw new Error(`DB error: ${error.message}`);
    return true;
  }

  // Idempotently create the default system rules for an org, INACTIVE. Safe to
  // call repeatedly — the unique (org, trigger, name) constraint + ignore means
  // only missing rows are inserted, and it never re-activates or overwrites a
  // rule a manager has since toggled/renamed.
  async seedDefaults(organizationId: string): Promise<void> {
    const rows = DEFAULT_RULES.map((r) => ({
      organization_id: organizationId,
      name: r.name,
      trigger: r.trigger,
      conditions: r.conditions,
      actions: r.actions,
      is_active: false,
      is_system: true,
    }));

    const { error } = await this.supabase
      .from('automation_rules')
      .upsert(rows, { onConflict: 'organization_id,trigger,name', ignoreDuplicates: true });

    if (error) throw new Error(`DB error: ${error.message}`);
  }

  // ─── Run log ────────────────────────────────────────────────────────────────

  async hasSuccessfulRun(eventId: string, ruleId: string, actionIndex: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('automation_run_log')
      .select('id')
      .eq('event_id', eventId)
      .eq('rule_id', ruleId)
      .eq('action_index', actionIndex)
      .eq('status', 'success')
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    return data !== null;
  }

  async insertRun(entry: {
    organizationId: string;
    ruleId: string;
    trigger: string;
    eventId: string;
    aggregateId: string | null;
    actionType: string;
    actionIndex: number;
    status: RunStatus;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from('automation_run_log').insert({
      organization_id: entry.organizationId,
      rule_id: entry.ruleId,
      trigger: entry.trigger,
      event_id: entry.eventId,
      aggregate_id: entry.aggregateId,
      action_type: entry.actionType,
      action_index: entry.actionIndex,
      status: entry.status,
      detail: entry.detail ?? {},
    });

    // The unique index on successful runs can reject a concurrent duplicate —
    // that's the dedup working, not a real error. Swallow the conflict.
    if (error && !/duplicate key|unique/i.test(error.message)) {
      throw new Error(`DB error: ${error.message}`);
    }
  }

  async findLogByOrg(organizationId: string, limit = 100): Promise<RunLogEntry[]> {
    const { data, error } = await this.supabase
      .from('automation_run_log')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`DB error: ${error.message}`);
    return ((data ?? []) as unknown as Array<{
      id: string;
      organization_id: string;
      rule_id: string | null;
      trigger: string;
      event_id: string;
      aggregate_id: string | null;
      action_type: string;
      action_index: number;
      status: RunStatus;
      detail: Record<string, unknown>;
      created_at: string;
    }>).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      ruleId: r.rule_id,
      trigger: r.trigger,
      eventId: r.event_id,
      aggregateId: r.aggregate_id,
      actionType: r.action_type,
      actionIndex: r.action_index,
      status: r.status,
      detail: r.detail ?? {},
      createdAt: r.created_at,
    }));
  }
}
