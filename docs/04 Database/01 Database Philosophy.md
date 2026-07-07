# Database Philosophy

---

## Core Principles

### 1. PostgreSQL is the Source of Truth
All business data lives in PostgreSQL. No distributed state. No eventual consistency for core records (reservations, finance). Supabase-hosted PostgreSQL with RLS is the single source of truth.

### 2. Every Table Has organization_id
No exceptions. Every table that contains business data must have an `organization_id` column. This is the foundation of multi-tenancy.

```sql
-- Template for every new table
CREATE TABLE [domain]_[entity] (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  -- ... domain columns
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz  -- soft delete, NULL means active
);
```

### 3. Soft Deletes for Financial Records
Financial records (reservations, revenue_entries, expenses, payouts, loans) are NEVER hard-deleted. Set `deleted_at` instead. All queries must filter `WHERE deleted_at IS NULL`.

Non-financial records (housekeeping tasks, communication logs) may be hard-deleted if no downstream references exist.

### 4. Dates vs Timestamps
- Use `date` type for calendar dates (check_in, check_out, period_month)
- Use `timestamptz` for events and mutations (created_at, cancelled_at, synced_at)
- Always store in UTC. Convert to property timezone in application layer.

### 5. Money as NUMERIC(14,2)
Never use FLOAT for money. Use `NUMERIC(14,2)` which stores exact decimal values.
- 14 digits total, 2 decimal places
- Supports up to ₹999,999,999,999.99
- Never divide in the database — compute in application to avoid precision errors

### 6. JSONB for Flexible Data
Use `jsonb` columns for:
- Channel-specific raw payloads (preserve original, never modify)
- Settings/configuration that varies per record
- AI recommendation details
- Feature flag conditions

Do NOT use JSONB for:
- Data you need to query/filter by column
- Financial amounts
- Dates that need date arithmetic

### 7. Indexes — Think Before Creating
Index everything you filter or sort on. But:
- Every index adds write overhead
- Add indexes when you have a real query, not "just in case"
- Use partial indexes for common filter patterns (e.g., `WHERE deleted_at IS NULL`)
- Use composite indexes when filtering by multiple columns together

### 8. RLS on Every Table
Every table with business data must have `ROW LEVEL SECURITY` enabled and at least one policy. A table with RLS enabled but no policies will return 0 rows for all users — which is safer than the alternative.

### 9. Foreign Keys — Always
Every reference must have a foreign key constraint. No "soft references" via application code. Exception: `raw` JSON payload columns from external APIs (they contain external IDs we don't own).

### 10. Migration Safety Rules
1. Never rename a column in production — add new column, backfill, deprecate old
2. Never drop a column without verifying zero application references
3. Never change a column type without considering casting implications
4. Always add `IF NOT EXISTS` / `IF EXISTS` guards in migrations
5. Test every migration on a staging clone before production
6. All migrations are forward-only — no down migrations in production

---

## Naming Conventions

| Object | Convention | Example |
|--------|-----------|---------|
| Tables | `snake_case`, plural | `reservations`, `property_finance_expenses` |
| Columns | `snake_case` | `organization_id`, `check_in`, `created_at` |
| Indexes | `idx_[table]_[column(s)]` | `idx_reservations_property_check_in` |
| Foreign keys | `fk_[table]_[referenced_table]` | auto-named by Postgres |
| RLS Policies | `[table]_[operation]_[role]` | `reservations_select_member` |
| Functions | `snake_case`, verb-first | `update_updated_at_column`, `claim_pending_jobs` |
| Triggers | `[timing]_[table]_[event]` | `before_reservations_insert` |
| Sequences | Handled by `uuid_generate_v4()` — no sequences |

---

## Standard Column Set

Every domain table includes:

```sql
id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
-- [domain columns here]
created_at      timestamptz NOT NULL DEFAULT now(),
updated_at      timestamptz NOT NULL DEFAULT now(),
created_by      uuid REFERENCES auth.users(id),
updated_by      uuid REFERENCES auth.users(id),
deleted_at      timestamptz  -- only on financial/critical records
```

The `updated_at` column is maintained automatically:
```sql
CREATE TRIGGER update_[table]_updated_at
  BEFORE UPDATE ON [table]
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Enum Strategy

Prefer text columns with CHECK constraints over PostgreSQL ENUMs:
- Easier to add values without migration DDL changes
- More readable in SQL queries
- Simpler introspection

```sql
-- PREFERRED
status text NOT NULL DEFAULT 'confirmed'
  CHECK (status IN ('inquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'conflict')),

-- AVOID
CREATE TYPE reservation_status AS ENUM ('confirmed', 'cancelled', ...);
```

---

## Supabase-Specific Rules

1. Always use `uuid_generate_v4()` for primary keys (requires `uuid-ossp` extension)
2. Auth references use `auth.users(id)` — Supabase manages this table
3. RLS policies must reference `auth.uid()` — the currently authenticated user
4. Use `SECURITY DEFINER` for functions that need to bypass RLS (e.g., auto-creating a user profile on signup)
5. Storage bucket access controlled by Supabase Storage policies (separate from table RLS)
6. Realtime subscriptions are table-level — design tables to support narrow channel subscriptions

---

## Performance Guidelines

### Queries to Avoid
```sql
-- BAD: full table scan
SELECT * FROM reservations WHERE organization_id = $1;

-- BAD: unindexed sort
SELECT * FROM reservations ORDER BY check_in;

-- BAD: no limit
SELECT * FROM reservations WHERE property_id = $1;

-- GOOD: indexed, paginated
SELECT * FROM reservations
WHERE property_id = $1
  AND deleted_at IS NULL
ORDER BY check_in DESC
LIMIT 50 OFFSET 0;
```

### Required Indexes (every table)
1. Index on `organization_id` (for tenant filtering)
2. Index on `property_id` where applicable
3. Index on `created_at DESC` for recent-first pagination
4. Composite index on `(property_id, check_in)` for reservation calendar queries
5. Partial index on `deleted_at IS NULL` where soft deletes used heavily
