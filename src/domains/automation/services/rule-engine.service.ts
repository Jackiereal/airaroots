import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomainEvent } from '../../../infrastructure/events/event-bus';
import type { AutomationTrigger } from '../types';
import { AutomationRuleRepository } from '../repositories/automation-rule.repository';
import { buildContext, bindParams } from './binding';
import { evaluateConditions } from './condition-evaluator';
import { getActionHandler } from './action-registry';

// ─── Rule engine ──────────────────────────────────────────────────────────────
// Subscribes to reservation.* events off the in-process bus. For each active
// rule matching (org, trigger): evaluate conditions, then run each action IN
// ORDER via the action registry.
//
// CRITICAL: handleEvent NEVER throws. The bus runs handlers under Promise.all,
// so a thrown handler rejects the whole publish and the triggering API request.
// Every layer here is wrapped so the promise always resolves:
//   - the whole method is inside a top-level try/catch
//   - each action is inside its own try/catch → a failure is logged and the
//     next action still runs
//   - each run-log write is best-effort
//
// Idempotency: before running an action we check for a prior SUCCESSFUL run of
// the same (event_id, rule_id, action_index). Combined with the unique index in
// migration 023, a re-published event cannot double-fire an action. The action
// services also do their own dedup (e.g. findTaskByReservation) as a second line.

export class RuleEngineService {
  private repo: AutomationRuleRepository;

  constructor(private supabase: SupabaseClient) {
    this.repo = new AutomationRuleRepository(supabase);
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    try {
      const trigger = event.eventType as AutomationTrigger;
      const rules = await this.repo.findActive(event.organizationId, trigger);
      if (rules.length === 0) return;

      const ctx = buildContext(event);

      for (const rule of rules) {
        // Rule-level condition gate. A skipped rule writes no log rows.
        if (!evaluateConditions(rule.conditions, ctx)) continue;

        for (let i = 0; i < rule.actions.length; i++) {
          await this.runAction(event, ctx, rule.id, rule.trigger, rule.actions[i], i);
        }
      }
    } catch (err) {
      // Absolute backstop — never let automation reject the publish.
      console.error('[automation] handleEvent failed:', err);
    }
  }

  private async runAction(
    event: DomainEvent,
    ctx: ReturnType<typeof buildContext>,
    ruleId: string,
    trigger: string,
    action: { type: string; params: Record<string, unknown> },
    index: number
  ): Promise<void> {
    try {
      // Dedup: skip if this action already succeeded for this event+rule.
      if (await this.repo.hasSuccessfulRun(event.eventId, ruleId, index)) return;

      const handler = getActionHandler(action.type);
      if (!handler) {
        await this.log(event, ruleId, trigger, action.type, index, 'skipped', {
          note: `unknown action type: ${action.type}`,
        });
        return;
      }

      const resolvedParams = bindParams(action.params ?? {}, ctx);
      const result = await handler(resolvedParams, event, event.organizationId, this.supabase);

      await this.log(event, ruleId, trigger, action.type, index, result.status, {
        resolvedParams,
        resultId: result.resultId,
        note: result.note,
      });
    } catch (err) {
      // One action's failure never stops the others or rejects the request.
      const message = err instanceof Error ? err.message : String(err);
      await this.log(event, ruleId, trigger, action.type, index, 'failed', { error: message });
    }
  }

  private async log(
    event: DomainEvent,
    ruleId: string,
    trigger: string,
    actionType: string,
    index: number,
    status: 'success' | 'skipped' | 'failed',
    detail: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.repo.insertRun({
        organizationId: event.organizationId,
        ruleId,
        trigger,
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        actionType,
        actionIndex: index,
        status,
        detail,
      });
    } catch (err) {
      // Logging is best-effort; a failed log write must not break the engine.
      console.error('[automation] run-log write failed:', err);
    }
  }
}
