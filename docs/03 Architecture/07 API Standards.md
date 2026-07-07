# API Standards

---

## API Design Principles

1. **REST over RPC** — resources and HTTP verbs, not action-named endpoints
2. **Consistent response shape** — always `{ data }` or `{ error }`, never ad-hoc
3. **Pagination on all list endpoints** — never return unlimited results
4. **Versioning** — `v1` prefix when breaking changes required (avoid if possible)
5. **Idempotent mutations where possible** — PUT/PATCH safe to retry
6. **Consistent error codes** — see error catalog below

---

## URL Structure

```
/api/[domain]/[resource]/[id?]/[sub-resource?]

Examples:
GET    /api/reservations
GET    /api/reservations/:id
POST   /api/reservations
PATCH  /api/reservations/:id
DELETE /api/reservations/:id
GET    /api/reservations/:id/events
POST   /api/reservations/:id/cancel
POST   /api/reservations/:id/check-in
POST   /api/reservations/:id/check-out

GET    /api/properties
GET    /api/properties/:id
POST   /api/properties
PATCH  /api/properties/:id

GET    /api/properties/:id/reservations
GET    /api/properties/:id/finance/summary
GET    /api/properties/:id/calendar
POST   /api/properties/:id/calendar/block

GET    /api/guests
GET    /api/guests/:id
GET    /api/guests/:id/stays

GET    /api/channels
POST   /api/channels/:id/sync
GET    /api/channels/:id/sync/status

GET    /api/finance/summary
GET    /api/finance/:propertyId/summary
GET    /api/finance/:propertyId/expenses
POST   /api/finance/:propertyId/expenses
```

---

## Response Shapes

### Success — Single Object
```json
{
  "data": {
    "id": "res-123",
    "propertyId": "prop-456",
    "checkIn": "2026-10-15",
    "checkOut": "2026-10-18",
    "status": "confirmed"
  }
}
```

### Success — List
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Success — Mutation (no body)
```json
{ "success": true }
```

### Error Response
```json
{
  "error": {
    "code": "RESERVATION_CONFLICT",
    "message": "Dates conflict with existing reservation on Oct 15–18",
    "details": {
      "conflictingReservationId": "res-789",
      "conflictDates": { "from": "2026-10-16", "to": "2026-10-18" }
    }
  }
}
```

---

## HTTP Status Codes

| Code | When to use |
|------|-------------|
| 200 | Successful GET, PATCH, PUT |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE (no body) |
| 400 | Validation error (invalid input) |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (e.g., reservation conflict, duplicate) |
| 422 | Business rule violation (valid input, but operation not allowed) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

---

## Pagination

All list endpoints must support:
```
?limit=50&offset=0
```

Default: `limit=50`, max: `limit=200`

Cursor-based pagination for high-volume endpoints (events, audit log):
```
?limit=50&cursor=eyJpZCI6IjEyMyJ9
```

---

## Filtering & Sorting

```
GET /api/reservations?propertyId=xxx&status=confirmed&from=2026-10-01&to=2026-10-31
GET /api/reservations?sort=check_in&order=asc
GET /api/expenses?period=2026-10-01&category=maintenance
```

---

## Query Parameters Convention

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Items per page (default 50, max 200) |
| `offset` | integer | Pagination offset |
| `sort` | string | Field name to sort by |
| `order` | `asc\|desc` | Sort order (default desc) |
| `from` | date | Date range start (YYYY-MM-DD) |
| `to` | date | Date range end (YYYY-MM-DD) |
| `status` | string | Filter by status |
| `propertyId` | uuid | Filter by property |
| `channel` | string | Filter by channel |
| `q` | string | Text search |

---

## Authentication

All API routes require authentication except:
- `POST /api/auth/signin`
- `POST /api/auth/signup`
- `GET /api/auth/callback`
- `POST /api/webhooks/**` (uses signature verification instead)

**Header:** `Authorization: Bearer <jwt_token>`

Supabase handles JWT validation. In each route:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

---

## Organization Context

Every API request must resolve the organization context:

```typescript
// lib/auth/get-org-context.ts
export async function getOrgContext(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .single();

  if (!data) throw new UnauthorizedError('Not a member of any organization');
  return { organizationId: data.organization_id, role: data.role };
}
```

For multi-org users: org context resolved from `X-Organization-Id` header.

---

## Error Codes Reference

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Insufficient role/permissions |
| `NOT_FOUND` | 404 | Resource does not exist (or not in your org) |
| `VALIDATION_ERROR` | 400 | Zod validation failed |
| `RESERVATION_CONFLICT` | 409 | Dates overlap existing reservation |
| `PROPERTY_LIMIT_EXCEEDED` | 422 | Plan property limit reached |
| `USER_LIMIT_EXCEEDED` | 422 | Plan user limit reached |
| `CHANNEL_NOT_CONNECTED` | 422 | Channel not connected to property |
| `SYNC_IN_PROGRESS` | 409 | Channel sync already running |
| `GUEST_BLACKLISTED` | 422 | Guest on blacklist |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `RATE_LIMITED` | 429 | Too many requests |

---

## Rate Limiting

| Tier | Limit |
|------|-------|
| Per user (auth'd) | 100 req/min |
| Per organization | 1,000 req/min |
| Webhook endpoints | 500 req/min |
| AI endpoints | 10 req/min |
| File upload | 20 req/min |

Implementation: Supabase Edge Function rate limiting (Phase 2).

---

## Webhook API

Webhooks from channels (Airbnb, Booking.com) hit these endpoints:

```
POST /api/webhooks/airbnb
POST /api/webhooks/booking-com
```

All webhook handlers:
1. Verify signature (HMAC-SHA256 for Airbnb, custom for Booking.com)
2. Return 200 immediately (do not process inline)
3. Enqueue a background job for processing
4. Log the raw payload to `channel_webhook_logs`

```typescript
// app/api/webhooks/airbnb/route.ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get('X-Airbnb-Signature');

  if (!verifyAirbnbSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Log raw payload
  await logWebhook('airbnb', payload);

  // Enqueue job — do not process inline
  await enqueueJob('channel.process_airbnb_webhook', { payload });

  return NextResponse.json({ received: true });
}
```

---

## API Documentation

All API routes must be documented inline with JSDoc:

```typescript
/**
 * Create a new reservation
 *
 * @route POST /api/reservations
 * @auth Required
 * @body CreateReservationInput
 * @returns {Reservation} 201 — Created reservation
 * @returns {ValidationError} 400 — Invalid input
 * @returns {ConflictError} 409 — Date conflict
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  ...
}
```

OpenAPI spec generation: Phase 8. Use `next-swagger-doc` or manual `openapi.yaml`.
