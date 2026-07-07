# Folder Structure

---

## Current Structure (Existing)

```
airaroots/
  app/
    api/
      admin/
      finance/[propertyId]/
      properties/
      auth/
    admin/
    client/
    dashboard/
    properties/[propertyId]/
  components/
    admin/
    client/
    finance/
    property/
  lib/
    admin/
    auth.ts
    finance/
    property-finance/
    supabase/
    utils.ts
  types/
  supabase/
    migrations/
```

**Problem:** No domain separation. Components and lib files are flat and mixed. This will not scale.

---

## Target Structure (Phase 1+)

Adopt domain-driven folder structure. Migrate incrementally — do not refactor everything at once.

```
airaroots/
  app/                              # Next.js App Router pages + API routes
    (auth)/
      signin/
      signup/
      callback/
    (dashboard)/
      layout.tsx                    # Dashboard shell
      page.tsx                      # Dashboard home
      properties/
        page.tsx
        [propertyId]/
          page.tsx
          reservations/
          finance/
          operations/
      calendar/
        page.tsx
      guests/
        page.tsx
      analytics/
        page.tsx
      settings/
        page.tsx
      billing/
        page.tsx
    (client)/                       # Owner portal
      dashboard/
      properties/[propertyId]/
    (admin)/                        # Platform admin
      users/
      organizations/
    api/
      reservations/
        route.ts
        [id]/route.ts
      properties/
        route.ts
        [id]/route.ts
      calendar/
        route.ts
      finance/
        [propertyId]/
          summary/route.ts
          expenses/route.ts
      guests/
        route.ts
      channels/
        [connectionId]/sync/route.ts
      webhooks/
        airbnb/route.ts
        booking-com/route.ts
      ai/
        insights/route.ts
      billing/
        route.ts
      admin/
        route.ts

  src/                              # All business logic (not pages)
    domains/
      organization/
        types.ts
        schema.ts                   # Zod schemas
        services/
          organization.service.ts
        repositories/
          organization.repository.ts
        event-handlers/
          index.ts
        __tests__/
          organization.service.test.ts

      reservation/
        types.ts
        schema.ts
        constants.ts                # Status values, etc.
        services/
          reservation.service.ts
          conflict-detection.service.ts
        repositories/
          reservation.repository.ts
        event-handlers/
          finance.handler.ts        # Handles reservation events → finance
          calendar.handler.ts
          housekeeping.handler.ts
          communication.handler.ts
        __tests__/

      calendar/
        types.ts
        services/
          calendar.service.ts
          availability.service.ts
        repositories/
          calendar.repository.ts
        __tests__/

      guest/
        types.ts
        services/
          guest.service.ts
        repositories/
          guest.repository.ts
        __tests__/

      finance/
        types.ts
        services/
          finance.service.ts
          revenue.service.ts
          expense.service.ts
          loan.service.ts
        repositories/
          finance.repository.ts
          expense.repository.ts
        __tests__/

      operations/
        types.ts
        services/
          housekeeping.service.ts
          maintenance.service.ts
          inventory.service.ts
        repositories/
          housekeeping.repository.ts
          maintenance.repository.ts
        __tests__/

      channel/
        types.ts
        services/
          channel.service.ts
          sync.service.ts
        adapters/
          airbnb.adapter.ts
          booking-com.adapter.ts
          base.adapter.ts
        repositories/
          channel.repository.ts
        __tests__/

      communication/
        types.ts
        services/
          communication.service.ts
          template.service.ts
        providers/
          whatsapp.provider.ts
          email.provider.ts
          sms.provider.ts
        __tests__/

      ai/
        types.ts
        services/
          pricing.service.ts
          forecasting.service.ts
          anomaly.service.ts
        agents/
          pricing.agent.ts
          forecasting.agent.ts
        __tests__/

      billing/
        types.ts
        services/
          subscription.service.ts
          invoice.service.ts
        providers/
          razorpay.provider.ts
          stripe.provider.ts
        __tests__/

    shared/
      types/
        common.types.ts
        pagination.types.ts
      constants/
        channels.ts
        roles.ts
        plan-features.ts
      errors/
        app-error.ts
        domain-errors.ts
      utils/
        date.ts
        currency.ts
        pagination.ts

    infrastructure/
      supabase/
        client.ts
        server.ts
        middleware.ts
        types.ts                    # Generated DB types
      events/
        event-bus.ts
        register-handlers.ts
      jobs/
        job-queue.ts
        job-processor.ts
        handlers/
          channel-sync.handler.ts
          communication.handler.ts
          reports.handler.ts
      cache/
        cache.ts
      logger/
        logger.ts

  components/
    ui/                             # Generic Radix/Tailwind primitives
      button.tsx
      dialog.tsx
      table.tsx
      form.tsx
      badge.tsx
      ...
    layout/
      DashboardShell.tsx
      Sidebar.tsx
      Header.tsx
      MobileNav.tsx
    calendar/
      ReservationCalendar.tsx
      TimelineView.tsx
      MonthView.tsx
      ReservationCard.tsx
      BlockDateModal.tsx
    reservation/
      ReservationForm.tsx
      ReservationDetail.tsx
      ReservationStatusBadge.tsx
    finance/
      FinanceDashboard.tsx
      RevenueEngine.tsx
      ExpenseEngine.tsx
      [existing components]
    operations/
      HousekeepingBoard.tsx
      MaintenanceList.tsx
      TaskCard.tsx
    guest/
      GuestProfile.tsx
      GuestList.tsx

  supabase/
    migrations/
      001_initial_schema.sql
      002_add_projections_config.sql
      003_add_reservations.sql      # Phase 1
      004_add_calendar_blocks.sql
      005_add_guests.sql
      006_add_channels.sql          # Phase 2
      ...

  docs/                             # This handbook
```

---

## Migration Strategy

Do NOT refactor everything at once. Migrate incrementally:

**Step 1 (Phase 1 start):** Create `src/` directory. Add new Phase 1 code using the new structure.

**Step 2 (Phase 1):** Move finance services into `src/domains/finance/` without changing the API routes or components (yet).

**Step 3 (Phase 2):** New domains (channel, reservation) built entirely in `src/domains/`.

**Step 4 (Phase 3):** Move existing components to `components/` subdomain folders. Update imports.

**Rule:** Never break existing functionality during refactoring. Run tests before and after every move.

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Domain types | PascalCase | `Reservation`, `FinanceSummary` |
| Service files | `[name].service.ts` | `reservation.service.ts` |
| Repository files | `[name].repository.ts` | `reservation.repository.ts` |
| Event handler files | `[domain].handler.ts` | `finance.handler.ts` |
| API route files | `route.ts` | Standard Next.js |
| Component files | `PascalCase.tsx` | `ReservationCalendar.tsx` |
| Hook files | `use[Name].ts` | `useReservations.ts` |
| Util files | `kebab-case.ts` | `date-utils.ts` |
| Test files | `[name].test.ts` | `reservation.service.test.ts` |
| Migration files | `[NNN]_[description].sql` | `003_add_reservations.sql` |
| Constant files | `[name].ts` (lowercase) | `channels.ts` |
