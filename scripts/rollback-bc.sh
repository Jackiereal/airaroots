#!/usr/bin/env bash
# Rollback for tasks B (migration 013) + C (migration 014 + route-auth migration).
# Safe only while these changes are uncommitted (git status shows them as modified/untracked).
# Data loss on the DB side is acceptable per this rollback's design — it resets, not restores.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Reverting modified files..."
git checkout -- \
  "app/api/finance/[propertyId]/activity/route.ts" \
  "app/api/finance/[propertyId]/airbnb-rows/[id]/route.ts" \
  "app/api/finance/[propertyId]/direct-bookings/[id]/route.ts" \
  "app/api/finance/[propertyId]/direct-bookings/route.ts" \
  "app/api/finance/[propertyId]/direct-bookings/upcoming/route.ts" \
  "app/api/finance/[propertyId]/expenses/[id]/route.ts" \
  "app/api/finance/[propertyId]/expenses/out-of-pocket/route.ts" \
  "app/api/finance/[propertyId]/expenses/route.ts" \
  "app/api/finance/[propertyId]/historical-averages/route.ts" \
  "app/api/finance/[propertyId]/import/route.ts" \
  "app/api/finance/[propertyId]/loans/route.ts" \
  "app/api/finance/[propertyId]/projections-config/route.ts" \
  "app/api/finance/[propertyId]/summary-all/route.ts" \
  "app/api/finance/[propertyId]/summary/route.ts" \
  "app/api/properties/[propertyId]/owners/route.ts" \
  "app/api/properties/[propertyId]/route.ts" \
  "app/api/properties/route.ts" \
  "app/auth/callback/route.ts" \
  "src/shared/utils/route-auth.ts" \
  "types/database.types.ts"

echo "Removing new migration files..."
rm -f supabase/migrations/013_properties_org_scope.sql
rm -f supabase/migrations/014_signup_trigger_consolidation.sql

echo "Resetting local DB to pre-013 state (data loss expected, replays 001-012 only)..."
supabase db reset

echo "Rollback complete. Verify: npx tsc --noEmit && npm run build"
