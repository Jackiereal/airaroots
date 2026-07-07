# Guest Domain

> Phase: 3
> Status: Not built
> Depends on: Reservation domain (Phase 1)

---

## Overview

The Guest domain manages guest profiles, stay history, preferences, and communication. Guests are matched across channels using email and phone — a guest who booked via Airbnb in March and directly in October should have a single guest profile.

---

## Entities

### Guest (Aggregate Root)

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| first_name | text | |
| last_name | text? | |
| email | text? | |
| phone | text? | |
| country | text | Default: IN |
| id_type | text? | aadhaar, passport, driving_license, pan |
| id_number | text? | Encrypted at app layer |
| tags | text[] | ['vip', 'repeat', 'problematic', 'long_stay'] |
| internal_notes | text? | Not visible to guest |
| is_blacklisted | boolean | |
| blacklist_reason | text? | |
| channel_guest_ids | jsonb | { airbnb: 'ID123', booking_com: 'GUEST456' } |

---

## Guest Matching Logic

When a reservation is created, the system attempts to find an existing guest:

```typescript
async findOrCreateGuest(
  orgId: string,
  input: { name: string; email?: string; phone?: string; channelGuestId?: { channel: string; id: string } }
): Promise<Guest> {
  // Priority: 1) Channel guest ID, 2) Email, 3) Phone, 4) Create new
  if (input.channelGuestId) {
    const existing = await guestRepo.findByChannelId(orgId, input.channelGuestId);
    if (existing) return existing;
  }

  if (input.email) {
    const existing = await guestRepo.findByEmail(orgId, input.email);
    if (existing) {
      // Update channel ID if not already set
      return await guestRepo.updateChannelId(existing.id, input.channelGuestId);
    }
  }

  if (input.phone) {
    const existing = await guestRepo.findByPhone(orgId, input.phone);
    if (existing) return existing;
  }

  // Create new guest
  const [firstName, ...rest] = input.name.split(' ');
  return await guestRepo.create({
    organizationId: orgId,
    firstName,
    lastName: rest.join(' ') || undefined,
    email: input.email,
    phone: input.phone,
    channelGuestIds: input.channelGuestId
      ? { [input.channelGuestId.channel]: input.channelGuestId.id }
      : {},
  });
}
```

---

## Service Interface

```typescript
interface GuestService {
  findOrCreate(orgId: string, input: GuestMatchInput): Promise<Guest>;
  findById(id: string): Promise<Guest | null>;
  search(orgId: string, query: string): Promise<Guest[]>;
  update(id: string, input: UpdateGuestInput): Promise<Guest>;
  blacklist(id: string, reason: string): Promise<Guest>;
  unblacklist(id: string): Promise<Guest>;
  getStayHistory(guestId: string): Promise<StayHistorySummary[]>;
  getTags(guestId: string): Promise<string[]>;
  addTag(guestId: string, tag: string): Promise<Guest>;
  removeTag(guestId: string, tag: string): Promise<Guest>;
}

type StayHistorySummary = {
  reservationId: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  channel: string;
  totalSpend: number;
};
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/guests | List guests (org-scoped, paginated) |
| GET | /api/guests/:id | Guest profile |
| GET | /api/guests/:id/stays | Stay history |
| PATCH | /api/guests/:id | Update guest profile |
| POST | /api/guests/:id/blacklist | Blacklist guest |
| DELETE | /api/guests/:id/blacklist | Unblacklist |
| POST | /api/guests/:id/tags | Add tag |
| DELETE | /api/guests/:id/tags/:tag | Remove tag |

---

## Guest Tags

Standard tags (predefined):
- `vip` — VIP treatment, prioritize
- `repeat` — Auto-added when guest has 2+ stays
- `long_stay` — Auto-added for stays >7 nights
- `early_bird` — Books >60 days in advance
- `problematic` — Internal flag for difficult guests

Custom tags: organizations can add their own.

---

## Privacy Considerations

- Guest ID documents (Aadhaar, passport) are encrypted before storage
- GDPR: guests in EU can request data deletion (Phase 8)
- Guest data scoped to organization — not shared across organizations
- Even if the same real-world person books two different PMCs, they appear as separate guests in each org
