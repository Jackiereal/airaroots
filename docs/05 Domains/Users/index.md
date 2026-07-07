# Users & Auth Domain

> Phase: Existing + Phase 8 (organization roles)
> Status: Basic auth built

---

## Overview

Users and authentication are managed by Supabase Auth. The Users domain covers user profiles, roles, and access patterns.

---

## Current State

**Built:**
- Email/password auth via Supabase
- `user_profiles` table (id, role, full_name)
- `role` is global: 'admin' or 'client'
- Admin users manage the platform
- Client users have property_access grants

**Phase 8 changes:**
- Role moves from `user_profiles` to `organization_members`
- New roles: owner, admin, manager, viewer (per-org)
- Platform admin remains as a platform-level role
- Multi-org support

---

## User Profile

```typescript
type UserProfile = {
  id: string;         // Matches auth.users.id
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  timezone: string;   // Default: Asia/Kolkata
};
```

---

## Role Matrix (Current vs Target)

| Role | Current System | Target (Phase 8) |
|------|---------------|------------------|
| Platform Admin | user_profiles.role = 'admin' | Separate platform admin flag |
| Property Owner | user_profiles.role = 'client' + property_access | org role: 'owner' |
| PMC Admin | user_profiles.role = 'admin' | org role: 'admin' |
| Manager | — (not supported) | org role: 'manager' + property_assignments |
| Viewer | — (not supported) | org role: 'viewer' |
| Owner Portal | user_profiles.role = 'client' | property_access (separate from org) |

---

## Auth Flow

```
1. User visits app
2. Middleware (lib/supabase/middleware.ts) checks session
3. If no session → redirect to /auth/signin
4. User signs in → Supabase creates JWT
5. JWT stored in cookie (handled by Supabase SSR)
6. On subsequent requests → middleware refreshes token if near expiry
7. JWT decoded in API routes to get user.id
8. user.id used to query organization_members for role
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/signin | Sign in (Supabase handles) |
| POST | /api/auth/signup | Sign up |
| GET | /api/auth/callback | OAuth callback |
| GET | /api/users/me | Current user profile |
| PATCH | /api/users/me | Update profile |
| GET | /api/admin/users | List all users (platform admin) |
| PATCH | /api/admin/users/:id/role | Change global role |
