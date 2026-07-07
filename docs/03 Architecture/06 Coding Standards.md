# Coding Standards

---

## TypeScript

### Strict Mode — Always On
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Never Use `any`
```typescript
// BAD
function processPayload(data: any) { ... }

// GOOD — use unknown + narrow
function processPayload(data: unknown) {
  const parsed = PayloadSchema.parse(data); // Zod narrows to correct type
  ...
}
```

### Explicit Return Types on Services
```typescript
// BAD
async function createReservation(input) {
  ...
}

// GOOD
async function createReservation(input: CreateReservationInput): Promise<Reservation> {
  ...
}
```

### Use `type` over `interface` for data shapes
```typescript
// Prefer type for plain data shapes
type Reservation = {
  id: string;
  organizationId: string;
  ...
};

// Use interface when extending or implementing
interface ReservationService {
  create(input: CreateReservationInput): Promise<Reservation>;
}
```

---

## Zod Validation

All external inputs must be validated with Zod before use.

```typescript
// src/domains/reservation/schema.ts

import { z } from 'zod';

export const CreateReservationSchema = z.object({
  propertyId: z.string().uuid(),
  guestId: z.string().uuid().optional(),
  guestName: z.string().min(1).max(200),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  channel: z.enum(['airbnb', 'booking_com', 'direct', 'vrbo', 'expedia']),
  checkIn: z.string().date(), // YYYY-MM-DD
  checkOut: z.string().date(),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(10).default(0),
  nightlyRate: z.number().positive(),
  cleaningFee: z.number().min(0).default(0),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => new Date(data.checkOut) > new Date(data.checkIn),
  { message: 'Check-out must be after check-in', path: ['checkOut'] }
);

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
```

---

## API Routes

### Route Pattern
```typescript
// app/api/reservations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/supabase/server';
import { ReservationService } from '@/domains/reservation/services/reservation.service';
import { CreateReservationSchema } from '@/domains/reservation/schema';
import { AppError } from '@/shared/errors/app-error';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const input = CreateReservationSchema.parse(body); // throws ZodError if invalid

    const service = new ReservationService(supabase);
    const reservation = await service.create(input, user.id);

    return NextResponse.json(reservation, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[POST /api/reservations]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Rules
- Routes are thin — validate, call service, return
- No business logic in routes
- Always handle ZodError, AppError, and unknown errors separately
- Always log unexpected errors with route context
- Never return raw database errors to clients

---

## Service Pattern

```typescript
// src/domains/reservation/services/reservation.service.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { ReservationRepository } from '../repositories/reservation.repository';
import { ConflictDetectionService } from './conflict-detection.service';
import { eventBus } from '@/infrastructure/events/event-bus';
import { ConflictError, NotFoundError } from '@/shared/errors/domain-errors';
import type { Reservation, CreateReservationInput } from '../types';

export class ReservationService {
  private repository: ReservationRepository;
  private conflictDetection: ConflictDetectionService;

  constructor(private supabase: SupabaseClient) {
    this.repository = new ReservationRepository(supabase);
    this.conflictDetection = new ConflictDetectionService(supabase);
  }

  async create(input: CreateReservationInput, actorId: string): Promise<Reservation> {
    // 1. Business validation
    const conflicts = await this.conflictDetection.check(
      input.propertyId,
      new Date(input.checkIn),
      new Date(input.checkOut)
    );

    if (conflicts.length > 0) {
      throw new ConflictError('Dates conflict with existing reservation', conflicts);
    }

    // 2. Create record
    const reservation = await this.repository.create({
      ...input,
      status: 'confirmed',
      createdBy: actorId,
    });

    // 3. Emit event (triggers finance, calendar, housekeeping, communication)
    await eventBus.publish({
      eventId: crypto.randomUUID(),
      eventType: 'reservation.created',
      aggregateId: reservation.id,
      aggregateType: 'reservation',
      organizationId: reservation.organizationId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { reservation },
    });

    return reservation;
  }
}
```

---

## Repository Pattern

```typescript
// src/domains/reservation/repositories/reservation.repository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/infrastructure/supabase/types';
import type { Reservation } from '../types';

type ReservationRow = Database['public']['Tables']['reservations']['Row'];

export class ReservationRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Reservation | null> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;

    return this.toEntity(data);
  }

  async findByProperty(
    propertyId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<Reservation[]> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .order('check_in', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map(this.toEntity);
  }

  async findConflicts(
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeId?: string
  ): Promise<Reservation[]> {
    let query = this.supabase
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId)
      .not('status', 'eq', 'cancelled')
      .is('deleted_at', null)
      .lt('check_in', checkOut.toISOString())
      .gt('check_out', checkIn.toISOString());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map(this.toEntity);
  }

  private toEntity(row: ReservationRow): Reservation {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id,
      guestId: row.guest_id ?? undefined,
      channel: row.channel as Reservation['channel'],
      platformBookingId: row.platform_booking_id ?? undefined,
      checkIn: row.check_in,
      checkOut: row.check_out,
      nights: row.nights,
      adults: row.adults,
      children: row.children ?? 0,
      status: row.status as Reservation['status'],
      nightlyRate: Number(row.nightly_rate),
      cleaningFee: Number(row.cleaning_fee ?? 0),
      grossRevenue: Number(row.gross_revenue ?? 0),
      platformCommission: Number(row.platform_commission ?? 0),
      netPayout: Number(row.net_payout ?? 0),
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
```

---

## Error Handling

```typescript
// src/shared/errors/app-error.ts

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// src/shared/errors/domain-errors.ts

export class ConflictError extends AppError {
  constructor(message: string, public conflicts: unknown[]) {
    super(message, 409, 'RESERVATION_CONFLICT');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
```

---

## Testing Standards

```typescript
// src/domains/reservation/services/__tests__/reservation.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReservationService } from '../reservation.service';
import { ConflictError } from '@/shared/errors/domain-errors';

// Mock the repository
vi.mock('../repositories/reservation.repository');
vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: vi.fn() }
}));

describe('ReservationService', () => {
  let service: ReservationService;
  let mockSupabase: unknown;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new ReservationService(mockSupabase);
  });

  describe('create', () => {
    it('creates a reservation when no conflict exists', async () => {
      // Arrange
      mockFindConflicts([]);
      mockCreate({ id: 'res-123', ...validReservation });

      // Act
      const result = await service.create(validInput, 'user-456');

      // Assert
      expect(result.id).toBe('res-123');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'reservation.created' })
      );
    });

    it('throws ConflictError when dates overlap existing reservation', async () => {
      // Arrange
      mockFindConflicts([existingReservation]);

      // Act & Assert
      await expect(service.create(validInput, 'user-456'))
        .rejects.toThrow(ConflictError);
    });
  });
});
```

---

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** feat, fix, refactor, test, docs, chore, migration

**Examples:**
```
feat(reservation): add conflict detection on manual reservation creation

Checks for date overlaps before creating a reservation.
Emits reservation.conflict_detected event when conflict found.

Refs: Phase 1, FR-RES-04
```

```
migration(003): add reservations table with RLS policies
```

```
fix(finance): correct net_payout calculation when commission is null
```
