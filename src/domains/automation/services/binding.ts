import type { DomainEvent } from '../../../infrastructure/events/event-bus';
import type { Reservation } from '../../reservation/types';

// ─── Event → binding context ──────────────────────────────────────────────────
// Flattens the event payload into a dotted-path lookup table so both condition
// fields ('reservation.channel') and action-param bindings ('{{reservation.
// checkOut}}') resolve against the same shape.

export type BindingContext = Record<string, unknown>;

// Recursively flatten nested objects to dotted keys. Arrays and null are kept
// as leaf values (we don't index into arrays for rules).
function flattenInto(target: BindingContext, prefix: string, value: unknown): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flattenInto(target, prefix ? `${prefix}.${k}` : k, v);
    }
  } else {
    target[prefix] = value;
  }
}

export function buildContext(event: DomainEvent): BindingContext {
  const ctx: BindingContext = {};
  flattenInto(ctx, '', event.payload);
  ctx['event.organizationId'] = event.organizationId;
  ctx['event.aggregateId'] = event.aggregateId;
  ctx['event.eventType'] = event.eventType;
  ctx['event.occurredAt'] = event.occurredAt;
  return ctx;
}

// The reservation an action operates on: `new` for modified events, else
// `reservation`. Create-side slice only sees created/checked_in (both use
// `reservation`), but this keeps the accessor correct if triggers widen.
export function primaryReservation(event: DomainEvent): Reservation | null {
  const res = (event.payload['new'] ?? event.payload['reservation']) as Reservation | undefined;
  return res ?? null;
}

// ─── Param binding ────────────────────────────────────────────────────────────
// Resolve {{path}} references in action params against the context. Mirrors
// the renderTemplate {{key}} convention but supports dotted paths and preserves
// value types when the whole string is a single binding.

const WHOLE_BINDING = /^\{\{\s*([a-z0-9_.]+)\s*\}\}$/i;
const EMBEDDED_BINDING = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi;

function bindValue(value: unknown, ctx: BindingContext): unknown {
  if (typeof value !== 'string') return value;

  // Whole-string binding → return the raw typed value (numbers/dates preserved).
  const whole = value.match(WHOLE_BINDING);
  if (whole) return ctx[whole[1]];

  // Embedded binding(s) → string interpolation, unknown paths → ''.
  if (EMBEDDED_BINDING.test(value)) {
    return value.replace(EMBEDDED_BINDING, (_, path: string) => {
      const v = ctx[path];
      return v === undefined || v === null ? '' : String(v);
    });
  }

  return value;
}

// Resolve every param value; drop keys that bind to undefined so the downstream
// service sees an absent optional rather than an explicit undefined.
export function bindParams(
  params: Record<string, unknown>,
  ctx: BindingContext
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    const bound = bindValue(v, ctx);
    if (bound !== undefined) out[k] = bound;
  }
  return out;
}
