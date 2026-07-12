import type { Condition } from '../types';
import type { BindingContext } from './binding';

// Safe predicate evaluation over the flattened event context. NO eval — a small
// fixed operator set. All conditions must pass (implicit AND); an empty list
// always matches. Fail-closed: a missing field or a non-numeric operand on an
// ordering operator makes that condition false.

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function evaluateOne(cond: Condition, ctx: BindingContext): boolean {
  const actual = ctx[cond.field];

  switch (cond.op) {
    case 'eq':
      return actual === cond.value;
    case 'neq':
      return actual !== cond.value;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = coerceNumber(actual);
      const b = coerceNumber(cond.value);
      if (a === null || b === null) return false; // fail-closed
      if (cond.op === 'gt') return a > b;
      if (cond.op === 'gte') return a >= b;
      if (cond.op === 'lt') return a < b;
      return a <= b;
    }
    case 'in':
      return Array.isArray(cond.value) && cond.value.includes(actual);
    default:
      return false;
  }
}

export function evaluateConditions(conditions: Condition[], ctx: BindingContext): boolean {
  return conditions.every((c) => evaluateOne(c, ctx));
}
