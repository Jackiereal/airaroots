-- ─────────────────────────────────────────────
-- DROP LEGACY user_profiles.role
-- Era 1's global admin/client flag (migration 001). Superseded by
-- organization_members.role (org staff hierarchy) and property_access.role
-- (per-property grant) since migration 015 — every RLS policy reading this
-- column was repointed there already (015's step 10, audit_log). The last
-- app-code reader (app/client/layout.tsx's admin-redirect check) has just
-- been switched to hasAnyPropertyAccess(). No remaining reads/writes
-- anywhere in the app or DB. Safe to drop.
-- ─────────────────────────────────────────────

alter table user_profiles drop column role;
