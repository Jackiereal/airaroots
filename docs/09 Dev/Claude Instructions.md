# Claude Development Instructions

> This document tells Claude Code exactly how to work on the Airaroots codebase.
> Read this BEFORE writing any code.

---

## Before Every Session

1. Read `docs/README.md` — understand current state
2. Check `09 Dev/Roadmap.md` — confirm what phase we're in
3. Read the relevant Domain spec in `05 Domains/[domain]/index.md`
4. Read existing code for the area you'll touch
5. **Never assume** — if unsure about a design decision, ask

---

## Implementation Workflow

For every feature request, follow this sequence. Never skip steps.

### Step 1: Analyze

Before writing any code:

```
1. What domain does this belong to?
2. What tables are involved (new or existing)?
3. What domain events should this emit or consume?
4. What existing code must I NOT break?
5. Is this in the current phase, or am I being asked to jump ahead?
```

### Step 2: Architecture Plan

Write a plan BEFORE coding:

```markdown
## Plan: [Feature Name]

**Domain:** [domain name]
**Phase:** [1-9]

**Database changes:**
- [table: column/table to add/modify]

**New files:**
- src/domains/[domain]/services/[service].ts
- src/domains/[domain]/repositories/[repo].ts
- app/api/[route]/route.ts
- components/[domain]/[Component].tsx

**Events:**
- Emits: [event names]
- Consumes: [event names]

**API routes:**
- METHOD /api/path → description

**Risks:**
- [List any backward compatibility concerns]

**Migration required:** Yes/No
```

Wait for review before proceeding to coding. Do not skip this step.

### Step 3: Database First

If schema changes required:
1. Create migration file in `supabase/migrations/`
2. Use safe SQL (IF NOT EXISTS, IF EXISTS)
3. Include RLS policies
4. Include indexes
5. Test locally with Supabase CLI

### Step 4: Domain Layer

Build in this order:
1. Types (`types.ts`, Zod schema)
2. Repository (data access)
3. Service (business logic)
4. Unit tests for service

### Step 5: API Layer

1. Build route handler (thin — validate, call service, return)
2. Integration test for route

### Step 6: UI Layer

1. Build component
2. Connect to API via TanStack Query hook
3. Handle loading, error, empty states

### Step 7: Verify

Run through Definition of Done checklist. Every item.

---

## Code Patterns (Copy These)

### API Route Pattern

```typescript
// app/api/[domain]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/supabase/server';
import { [Domain]Service } from '@/domains/[domain]/services/[domain].service';
import { Create[Entity]Schema } from '@/domains/[domain]/schema';
import { handleRouteError } from '@/shared/utils/handle-route-error';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const input = Create[Entity]Schema.parse(body);

    const service = new [Domain]Service(supabase);
    const result = await service.create(input, user.id);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'POST /api/[domain]');
  }
}
```

### Service Pattern

```typescript
// src/domains/[domain]/services/[domain].service.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { [Domain]Repository } from '../repositories/[domain].repository';
import { eventBus } from '@/infrastructure/events/event-bus';

export class [Domain]Service {
  private repository: [Domain]Repository;

  constructor(private supabase: SupabaseClient) {
    this.repository = new [Domain]Repository(supabase);
  }

  async create(input: Create[Entity]Input, actorId: string): Promise<[Entity]> {
    // 1. Business validation
    // 2. Create record
    const entity = await this.repository.create({ ...input, createdBy: actorId });
    // 3. Emit domain event
    await eventBus.publish({
      eventId: crypto.randomUUID(),
      eventType: '[domain].[entity].created',
      aggregateId: entity.id,
      aggregateType: '[entity]',
      organizationId: entity.organizationId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { entity },
    });
    return entity;
  }
}
```

### Repository Pattern

```typescript
// src/domains/[domain]/repositories/[domain].repository.ts
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/infrastructure/supabase/types';

type EntityRow = Database['public']['Tables']['[table_name]']['Row'];

export class [Domain]Repository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<[Entity] | null> {
    const { data, error } = await this.supabase
      .from('[table_name]')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)  // Only if table has soft deletes
      .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;

    return this.toEntity(data);
  }

  private toEntity(row: EntityRow): [Entity] {
    return {
      id: row.id,
      // ... map all fields, camelCase conversion
    };
  }
}
```

---

## Things That Will Break the App — NEVER DO THESE

1. **Hard delete financial records** — `deleted_at` only
2. **Bypass auth in an API route** — always check user session first
3. **Put business logic in an API route** — services only
4. **Put a Supabase query directly in a component** — use API routes
5. **Break an existing API route signature** — additive changes only
6. **Drop a column without verifying zero usages** — grep first
7. **Commit `.env.local`** — add to .gitignore if not already
8. **Use `any` type** — use `unknown` + Zod
9. **Skip the conflict detection check** when creating reservations
10. **Modify `raw_payload`** — it's the source of truth from the channel

---

## Prompts for Common Tasks

### "Implement Phase 1: Reservation Domain"

```
Read:
- docs/05 Domains/Reservations/index.md
- docs/04 Database/02 Complete Schema.md (reservations section)
- docs/03 Architecture/03 Event Driven Architecture.md

Build in this order:
1. Migration: supabase/migrations/003_add_reservations.sql
2. Types: src/domains/reservation/types.ts
3. Schema: src/domains/reservation/schema.ts
4. Repository: src/domains/reservation/repositories/reservation.repository.ts
5. ConflictDetectionService
6. ReservationService
7. Tests
8. API routes
9. UI components

Do not move to step N+1 without completing step N and running tests.
```

### "Add a new field to reservations"

```
1. Check if column exists in 02 Complete Schema.md
2. Write migration to add column (ALTER TABLE IF NOT EXISTS)
3. Update types.ts to include field
4. Update repository toEntity() mapping
5. Update Zod schema if user-inputtable
6. Update API route to accept/return field
7. Update UI form/display
8. Test: verify field saved and returned correctly
```

### "Debug a broken channel sync"

```
1. Check channel_sync_logs: SELECT * FROM channel_sync_logs ORDER BY started_at DESC LIMIT 10
2. Check channel_connections: verify status = 'connected' and credentials valid
3. Check background_jobs: SELECT * FROM background_jobs WHERE type LIKE 'channel.%' AND status = 'failed'
4. Check channel_webhook_logs: any unprocessed webhooks?
5. Look for error message in sync_log.error column
6. If token expired: implement token refresh logic
```

---

## When to Stop and Ask

Stop coding and ask the user if:
1. The change would break an existing feature
2. The architecture decision has multiple valid approaches
3. A database migration is risky (dropping columns, changing types)
4. Conflict with something stated in this handbook
5. The requested feature is not in the current phase (confirm before jumping ahead)

Do not implement speculative features or "while I'm here" improvements.
