import type { SupabaseClient } from '@supabase/supabase-js';
import type { DomainEvent } from '../../../infrastructure/events/event-bus';
import type { ActionType } from '../types';
import { primaryReservation } from './binding';
import { HousekeepingService } from '../../operations/services/housekeeping.service';
import { MaintenanceService } from '../../operations/services/maintenance.service';
import { CalendarService } from '../../calendar/services/calendar.service';
import { NotificationService } from '../../communication/services/notification.service';
import { ConflictError } from '../../../shared/errors/domain-errors';
import type { CreateHousekeepingTaskInput, CreateMaintenanceRequestInput } from '../../operations/types';
import type { CreateBlockInput } from '../../calendar/types';
import type { NotificationTrigger, Channel, TemplateVars } from '../../communication/types';

// ─── Action dispatch ──────────────────────────────────────────────────────────
// Maps an action-type string to a handler that runs the corresponding existing
// service. The handler INJECTS identity (organizationId/propertyId/reservationId)
// from the trusted event — never from `params` — because the engine runs under a
// service-role client that bypasses RLS (IDOR mandate). Only non-identity fields
// come from the (already {{path}}-resolved) `params`.

export type ActionResult = {
  status: 'success' | 'skipped';
  resultId?: string;
  note?: string;
};

export type ActionHandler = (
  params: Record<string, unknown>,
  event: DomainEvent,
  orgId: string,
  supabase: SupabaseClient
) => Promise<ActionResult>;

function requireReservation(event: DomainEvent) {
  const reservation = primaryReservation(event);
  if (!reservation) throw new Error('action requires a reservation in the event payload');
  return reservation;
}

function toFirstOfMonth(dateStr: string): string {
  return dateStr.substring(0, 7) + '-01';
}

const handlers: Record<ActionType, ActionHandler> = {
  // ─── Housekeeping task ──────────────────────────────────────────────────────
  create_housekeeping_task: async (params, event, orgId, supabase) => {
    const reservation = requireReservation(event);
    const service = new HousekeepingService(supabase);

    const input: CreateHousekeepingTaskInput = {
      organizationId: orgId,
      propertyId: reservation.propertyId,
      reservationId: reservation.id,
      taskType: params['taskType'] as CreateHousekeepingTaskInput['taskType'],
      scheduledDate: String(params['scheduledDate']),
      scheduledTime: params['scheduledTime'] ? String(params['scheduledTime']) : undefined,
      notes: params['notes'] ? String(params['notes']) : undefined,
    };

    const task = await service.createTask(input);
    return { status: 'success', resultId: task.id };
  },

  // ─── Maintenance request ────────────────────────────────────────────────────
  create_maintenance_request: async (params, event, orgId, supabase) => {
    const reservation = requireReservation(event);
    const service = new MaintenanceService(supabase);

    const input: Omit<CreateMaintenanceRequestInput, 'organizationId'> = {
      propertyId: reservation.propertyId,
      reservationId: reservation.id,
      title: String(params['title'] ?? 'Maintenance'),
      description: params['description'] ? String(params['description']) : undefined,
      category: params['category'] as CreateMaintenanceRequestInput['category'],
      priority: params['priority'] as CreateMaintenanceRequestInput['priority'],
    };

    const request = await service.create(orgId, input);
    return { status: 'success', resultId: request.id };
  },

  // ─── Notification ───────────────────────────────────────────────────────────
  // recipient/vars come from params (bound from payload, e.g.
  // {{reservation.guestPhone}}). MVP supports only recipients present in the
  // payload; staff/owner lookups are deferred. notify() itself returns 'skipped'
  // if there is no template/recipient/adapter, which we surface as skipped.
  send_notification: async (params, event, orgId, supabase) => {
    const reservation = requireReservation(event);
    const service = new NotificationService(supabase);

    const recipientRaw = params['recipient'];
    const recipient = recipientRaw === undefined || recipientRaw === null || recipientRaw === ''
      ? null
      : String(recipientRaw);

    const result = await service.notify({
      organizationId: orgId,
      trigger: params['trigger'] as NotificationTrigger,
      channel: (params['channel'] as Channel) ?? 'whatsapp',
      recipient,
      vars: (params['vars'] as TemplateVars) ?? {},
      context: { reservation_id: reservation.id },
    });

    if (result.deliveryStatus === 'skipped') {
      return { status: 'skipped', note: 'notification skipped (no template/recipient/adapter)' };
    }
    return { status: 'success', note: result.deliveryStatus };
  },

  // ─── Calendar block ─────────────────────────────────────────────────────────
  // createBlock throws ConflictError when the dates already overlap a block —
  // for automation that means "already blocked", which we treat as skipped, not
  // a failure.
  create_calendar_block: async (params, event, orgId, supabase) => {
    const reservation = requireReservation(event);
    const service = new CalendarService(supabase);

    const input: CreateBlockInput = {
      organizationId: orgId,
      propertyId: reservation.propertyId,
      reservationId: reservation.id,
      startDate: String(params['startDate']),
      endDate: String(params['endDate']),
      blockType: (params['blockType'] as CreateBlockInput['blockType']) ?? 'reservation',
      reason: params['reason'] ? String(params['reason']) : undefined,
      isPublic: params['isPublic'] === undefined ? true : Boolean(params['isPublic']),
    };

    try {
      const block = await service.createBlock(input, 'automation');
      return { status: 'success', resultId: block.id };
    } catch (err) {
      if (err instanceof ConflictError) {
        return { status: 'skipped', note: 'dates already blocked' };
      }
      throw err;
    }
  },

  // ─── Direct-booking revenue ─────────────────────────────────────────────────
  // Reproduces finance.handler's create-side insert. No standalone service
  // exists, so this writes directly via the service-role client. Condition
  // `channel eq direct` is enforced by the rule, but we guard defensively.
  derive_direct_booking: async (_params, event) => {
    const reservation = requireReservation(event);
    if (reservation.channel !== 'direct') {
      return { status: 'skipped', note: 'not a direct-channel reservation' };
    }

    const db = (await import('../../../infrastructure/supabase/server')).createServiceRoleClientLoose();
    const { error } = await db.from('property_finance_direct_bookings').insert({
      property_id: reservation.propertyId,
      period_month: toFirstOfMonth(reservation.checkIn),
      guest_name: reservation.guestName ?? null,
      amount: reservation.netPayout,
      guest_count: reservation.adults + reservation.children,
      guest_phone: reservation.guestPhone ?? null,
      check_in: reservation.checkIn,
      check_out: reservation.checkOut,
      nights: reservation.nights,
      notes: `Auto-generated from reservation ${reservation.id} (${reservation.channel})`,
      reservation_id: reservation.id,
      source: 'reservation_engine',
    });

    if (error) throw new Error(`derive_direct_booking: ${error.message}`);
    return { status: 'success', resultId: reservation.id };
  },
};

export function getActionHandler(type: string): ActionHandler | null {
  return (handlers as Record<string, ActionHandler>)[type] ?? null;
}
