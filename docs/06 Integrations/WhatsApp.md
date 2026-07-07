# WhatsApp Integration

> Phase: 5
> Purpose: Guest communication automation

---

## Overview

WhatsApp is the primary guest communication channel in India. We use the **WhatsApp Business API** via a BSP (Business Solution Provider) to send automated messages to guests.

Recommended BSP: **Interakt** or **Wati** (India-based, good support, competitive pricing).
Alternative: Direct Meta API (more control, requires technical setup).

---

## What We Send

| Trigger | Message Type | When |
|---------|-------------|------|
| Booking confirmed | Template | Immediately after reservation created |
| Pre-arrival | Template | 48 hours before check-in |
| Check-in instructions | Template | Day of check-in, morning |
| Checkout reminder | Template | Day of checkout, morning |
| Review request | Template | 24 hours after checkout |
| Payment reminder | Template | For direct bookings with pending payment |

---

## Message Templates

WhatsApp Business API requires pre-approved message templates. Template categories and sample content:

### Booking Confirmation Template
```
Name: booking_confirmation
Category: UTILITY

Hi {{1}}! Your booking at {{2}} is confirmed. 🏠

📅 Check-in: {{3}}
📅 Check-out: {{4}}
👥 Guests: {{5}}

Your host will send check-in details 24 hours before arrival.

Need help? Reply to this message.
```

### Pre-Arrival Template
```
Name: pre_arrival_instructions
Category: UTILITY

Hi {{1}}, you're checking in at {{2}} tomorrow!

🔑 Check-in time: {{3}}
📍 Address: {{4}}
📞 Host contact: {{5}}

We'll send your access code the morning of check-in. See you soon!
```

### Check-In Instructions Template
```
Name: check_in_instructions
Category: UTILITY

Welcome {{1}}! Your stay at {{2}} starts today.

🔑 Access code: {{3}}
📍 Property address: {{4}}
📱 WiFi: {{5}} | Password: {{6}}

House rules: {{7}}

Enjoy your stay! Message us if you need anything.
```

---

## WhatsApp Provider Interface

```typescript
// src/domains/communication/providers/whatsapp.provider.ts

interface WhatsAppMessage {
  to: string;              // Phone in international format: +919876543210
  templateName: string;    // Pre-approved template name
  variables: string[];     // Template variable values
  language?: string;       // Default: en
}

interface WhatsAppProvider {
  sendTemplate(message: WhatsAppMessage): Promise<{ messageId: string }>;
  getDeliveryStatus(messageId: string): Promise<DeliveryStatus>;
}

// Implementation using Interakt API
export class InteraktWhatsAppProvider implements WhatsAppProvider {
  private readonly apiUrl = 'https://api.interakt.ai/v1/public/message/';

  async sendTemplate(message: WhatsAppMessage): Promise<{ messageId: string }> {
    const payload = {
      countryCode: '+91',
      phoneNumber: this.formatPhone(message.to),
      callbackData: 'airaroots',
      type: 'Template',
      template: {
        name: message.templateName,
        languageCode: message.language ?? 'en',
        bodyValues: message.variables,
      },
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${process.env.INTERAKT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return { messageId: data.id };
  }

  private formatPhone(phone: string): string {
    // Strip country code if present, return 10-digit number
    return phone.replace(/^\+91/, '').replace(/\D/g, '');
  }
}
```

---

## Communication Service

```typescript
// src/domains/communication/services/communication.service.ts

export class CommunicationService {
  async sendBookingConfirmation(reservation: Reservation): Promise<void> {
    const guest = await guestRepo.findById(reservation.guestId!);
    if (!guest?.phone) return;  // No phone, skip WhatsApp

    const template = await templateRepo.findByTrigger(
      reservation.organizationId,
      'booking_confirmation',
      'whatsapp'
    );

    const variables = [
      guest.firstName,
      reservation.propertyName,
      format(new Date(reservation.checkIn), 'MMM dd, yyyy'),
      format(new Date(reservation.checkOut), 'MMM dd, yyyy'),
      String(reservation.adults + reservation.children),
    ];

    const { messageId } = await whatsappProvider.sendTemplate({
      to: guest.phone,
      templateName: template?.name ?? 'booking_confirmation',
      variables,
    });

    await communicationLogRepo.create({
      organizationId: reservation.organizationId,
      propertyId: reservation.propertyId,
      reservationId: reservation.id,
      guestId: guest.id,
      channel: 'whatsapp',
      direction: 'outbound',
      recipient: guest.phone,
      body: `Booking confirmation sent`,
      status: 'sent',
      providerMsgId: messageId,
      sentAt: new Date(),
    });
  }
}
```

---

## Automation Rules

Automated messages are triggered by background jobs:

```typescript
// reservation.created → enqueueJob('communication.send_booking_confirmation', { reservationId })
// reservation.checked_out + 24hr → enqueueJob('communication.send_review_request', { reservationId })

// Pre-arrival: daily 8am cron
// Find all reservations with check_in = tomorrow
// For each: enqueueJob('communication.send_pre_arrival', { reservationId })
```

---

## Cost Considerations

WhatsApp Business API pricing (Meta):
- Utility templates (booking-related): ~₹0.35–0.55/message in India
- Marketing templates (promotions): ~₹0.80–1.10/message

Estimated cost at scale: ₹0.50 × 5 messages/reservation × 10,000 reservations/month = ₹25,000/month

Include WhatsApp message cost in pro plan calculation. First 500 messages/month included. ₹0.50/message above that.

---

## Fallback Strategy

If guest has no WhatsApp or message fails:
1. Try SMS via Twilio (₹0.40/SMS in India)
2. If no phone, fall back to email via Resend
3. Log each attempt in communication_logs
