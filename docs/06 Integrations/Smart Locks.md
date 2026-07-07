# Smart Locks Integration

> Phase: Future (Post Phase 8)
> Purpose: Automated access code management

---

## Overview

Smart lock integration automatically generates and sends unique access codes to guests for each reservation. The code is sent in the pre-arrival WhatsApp message and expires at checkout time.

---

## Supported Lock Systems (Planned)

| Brand | API | Notes |
|-------|-----|-------|
| Yale Smart Locks | Yale Access API | Popular in India |
| TTLock | TTLock API | Used in many Indian villas |
| Schlage | Schlage API | Premium segment |
| August | August API | US-focused |

---

## Integration Pattern

```typescript
// src/domains/channel/adapters/smart-lock.adapter.ts

interface SmartLockAdapter {
  createAccessCode(
    lockId: string,
    code: string,
    validFrom: Date,
    validTo: Date,
    guestName: string
  ): Promise<{ success: boolean; codeId: string }>;

  deleteAccessCode(lockId: string, codeId: string): Promise<void>;
  getAccessLogs(lockId: string, from: Date, to: Date): Promise<AccessLog[]>;
}
```

## Reservation Lifecycle Integration

```
Reservation confirmed → Generate 6-digit access code
                      → Set valid from: check_in day 2pm
                      → Set valid to: check_out day 12pm
                      → Send code in pre-arrival WhatsApp message

Reservation cancelled → Delete access code immediately
```

---

## Data Model Extension (Future)

```sql
CREATE TABLE property_smart_locks (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id),
  lock_brand  text NOT NULL,   -- 'ttlock', 'yale', 'august'
  lock_id     text NOT NULL,   -- External lock identifier
  credentials jsonb,           -- Encrypted API credentials
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE reservation_access_codes (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  lock_id        uuid NOT NULL REFERENCES property_smart_locks(id),
  code           text NOT NULL,
  valid_from     timestamptz NOT NULL,
  valid_to       timestamptz NOT NULL,
  external_code_id text,
  created_at     timestamptz DEFAULT now()
);
```

---

## TTLock API (Most Common in India)

TTLock is widely used in Indian vacation rental properties.

```typescript
export class TTLockAdapter implements SmartLockAdapter {
  private readonly baseUrl = 'https://euapi.ttlock.com/v3';

  async createAccessCode(lockId: string, code: string, validFrom: Date, validTo: Date): Promise<{ success: boolean; codeId: string }> {
    const params = new URLSearchParams({
      clientId: process.env.TTLOCK_CLIENT_ID!,
      accessToken: await this.getAccessToken(),
      lockId,
      keyboardPwd: code,
      keyboardPwdName: 'Guest Access',
      startDate: validFrom.getTime().toString(),
      endDate: validTo.getTime().toString(),
      date: Date.now().toString(),
    });

    const response = await fetch(`${this.baseUrl}/keyboardPwd/add?${params}`);
    const data = await response.json();

    return {
      success: data.errcode === 0,
      codeId: data.keyboardPwdId?.toString() ?? '',
    };
  }
}
```

---

## Security Considerations

1. Access codes are temporary — expire exactly at checkout time
2. If reservation is extended, code expiry is updated automatically
3. Codes stored encrypted in database (or just stored by reference ID on TTLock side)
4. Access logs reviewed by managers — who entered when
5. Emergency override: manager can always generate a new code via app

This feature is a Phase 8+ premium feature — only for Pro/Enterprise plans.
