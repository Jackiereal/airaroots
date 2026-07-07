# Error Handling

---

## Error Hierarchy

```
Error (built-in)
  └── AppError (base for all app errors)
        ├── ValidationError      (400) — invalid input
        ├── UnauthorizedError    (401) — not authenticated
        ├── ForbiddenError       (403) — authenticated, not permitted
        ├── NotFoundError        (404) — resource not found
        ├── ConflictError        (409) — state conflict
        ├── BusinessRuleError    (422) — operation not allowed by business rules
        └── InternalError        (500) — unexpected server error
```

---

## Error Class Definitions

```typescript
// src/shared/errors/app-error.ts

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean = true;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// src/shared/errors/domain-errors.ts

export class ValidationError extends AppError {
  constructor(message: string, public readonly details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} not found: ${id}` : `${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, public readonly conflicts?: unknown) {
    super(message, 409, 'CONFLICT');
  }
}

export class ReservationConflictError extends ConflictError {
  constructor(public readonly conflictingReservations: Array<{ id: string; checkIn: string; checkOut: string }>) {
    super('Reservation dates conflict with existing booking', conflictingReservations);
    this.code = 'RESERVATION_CONFLICT';
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 422, code ?? 'BUSINESS_RULE_VIOLATION');
  }
}

export class PlanLimitError extends BusinessRuleError {
  constructor(resource: string, limit: number) {
    super(`Plan limit reached: maximum ${limit} ${resource} allowed`, 'PLAN_LIMIT_EXCEEDED');
  }
}
```

---

## Route-Level Error Handler

Every API route must use the same error handling pattern:

```typescript
// src/shared/utils/handle-route-error.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '../errors/app-error';
import { logger } from '@/infrastructure/logger/logger';

export function handleRouteError(error: unknown, routeContext: string): NextResponse {
  // 1. Zod validation errors
  if (error instanceof z.ZodError) {
    return NextResponse.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    }, { status: 400 });
  }

  // 2. Known operational errors
  if (error instanceof AppError && error.isOperational) {
    return NextResponse.json({
      error: {
        code: error.code,
        message: error.message,
      },
    }, { status: error.statusCode });
  }

  // 3. Unknown errors — log and return generic message
  logger.error(`Unexpected error in ${routeContext}`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return NextResponse.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
    },
  }, { status: 500 });
}
```

Usage:
```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ...
  } catch (error) {
    return handleRouteError(error, 'POST /api/reservations');
  }
}
```

---

## Service-Level Error Handling

Services throw domain errors. They do NOT catch and swallow:

```typescript
// BAD — swallows errors, caller doesn't know what happened
async function createReservation(input) {
  try {
    const result = await repository.create(input);
    return result;
  } catch (e) {
    return null; // NEVER DO THIS
  }
}

// GOOD — throws appropriate error, let route handler deal with it
async function createReservation(input: CreateReservationInput): Promise<Reservation> {
  const conflicts = await this.conflictDetection.check(...);
  if (conflicts.length > 0) {
    throw new ReservationConflictError(conflicts);
  }

  const reservation = await this.repository.create(input);
  // repository.create throws if DB fails — let it propagate
  return reservation;
}
```

---

## Repository-Level Error Handling

Repositories map Supabase errors to domain errors:

```typescript
async findById(id: string): Promise<Reservation | null> {
  const { data, error } = await this.supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    throw new Error(`Database error: ${error.message}`);
  }

  return data ? this.toEntity(data) : null;
}
```

---

## Client-Side Error Handling

TanStack Query with global error boundary:

```typescript
// components/providers/query-provider.tsx

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error) => {
        toast.error(getErrorMessage(error));
      },
    },
  },
});

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message; // Use server-provided message
  }
  return 'Something went wrong. Please try again.';
}
```

---

## User-Facing Error Messages

Rules:
1. Never show stack traces or raw DB errors to users
2. Always tell the user what to do next
3. Use plain language, not error codes

| Error Code | User-Facing Message |
|-----------|---------------------|
| `RESERVATION_CONFLICT` | "These dates are already booked. Please choose different dates or contact support." |
| `VALIDATION_ERROR` | Show inline field errors from the `details` array |
| `PLAN_LIMIT_EXCEEDED` | "You've reached your plan's property limit. Upgrade to add more." |
| `CHANNEL_NOT_CONNECTED` | "Connect your Airbnb account first in Settings → Channels." |
| `UNAUTHORIZED` | Redirect to sign-in page |
| `FORBIDDEN` | "You don't have permission to do this. Contact your administrator." |
| `NOT_FOUND` | "This item no longer exists or was removed." |
| `INTERNAL_ERROR` | "Something went wrong on our end. We've been notified. Please try again in a few minutes." |

---

## Error Monitoring

All unexpected errors (non-operational) must be reported to monitoring:

```typescript
// src/infrastructure/logger/logger.ts

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }));
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', message, ...meta, timestamp: new Date().toISOString() }));
    // Phase 3: Send to Sentry or similar
    // reportToSentry({ message, meta });
  },
};
```

Log structure enables filtering in Vercel/Supabase log viewers.
