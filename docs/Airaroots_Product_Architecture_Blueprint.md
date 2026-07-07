# Airaroots Product Architecture & Development Blueprint

> Version: 1.0\
> Audience: Claude Code / Engineering AI\
> Purpose: This document is the authoritative specification for
> Airaroots. Read this completely before implementing any feature.

------------------------------------------------------------------------

# 1. Mission

Airaroots is **not** another Property Management System (PMS).

It is a **Hospitality Business Operating System**.

The platform must help property owners and management companies operate,
analyze, automate, and grow hospitality businesses.

Primary users:

-   Individual property owners
-   Boutique hospitality brands
-   Property management companies (5--500 properties)
-   Multi-brand organizations

The core objective is to maximize: - Profitability - Operational
efficiency - Owner transparency - Guest satisfaction

------------------------------------------------------------------------

# 2. Product Principles

1.  Reservations are the source of truth.
2.  Finance is derived from reservations.
3.  Everything belongs to an Organization.
4.  Every module is independently deployable.
5.  Domain Driven Design.
6.  API-first.
7.  AI is an assistant, never the source of truth.
8.  Never break backward compatibility.
9.  Every feature must scale to hundreds of properties.
10. Favor automation over manual workflows.

------------------------------------------------------------------------

# 3. High Level Architecture

    Organization
        ├── Users & Roles
        ├── Properties
        │      ├── Reservations
        │      │      ├── Guests
        │      │      ├── Calendar
        │      │      ├── Availability
        │      │      └── Channels
        │      ├── Operations
        │      │      ├── Housekeeping
        │      │      ├── Maintenance
        │      │      ├── Inventory
        │      │      └── Vendors
        │      ├── Finance
        │      ├── Reports
        │      └── AI
        └── Billing

------------------------------------------------------------------------

# 4. Target Tech Stack

-   Next.js App Router
-   TypeScript (strict)
-   Supabase PostgreSQL
-   Supabase Auth
-   Row Level Security
-   Tailwind CSS
-   Radix UI
-   TanStack Query
-   Zod
-   React Hook Form
-   Recharts
-   Background jobs (queue)
-   Event-driven services

------------------------------------------------------------------------

# 5. Domain Structure

    src/
      domains/
        organization/
        auth/
        property/
        reservation/
        guest/
        calendar/
        finance/
        operations/
        communication/
        ai/
        analytics/
        billing/
      shared/
      ui/
      lib/

Each domain owns: - schema - services - repositories - APIs - UI -
tests - types

------------------------------------------------------------------------

# 6. Multi-Tenant SaaS

Every table contains:

-   id
-   organization_id
-   property_id (optional)
-   created_at
-   updated_at
-   created_by
-   updated_by
-   deleted_at

Never hard delete financial data.

------------------------------------------------------------------------

# 7. Reservation Domain

Reservation is the central entity.

Suggested fields:

-   platform
-   platform_booking_id
-   guest_id
-   property_id
-   check_in
-   check_out
-   adults
-   children
-   pets
-   nightly_rate
-   taxes
-   fees
-   payout
-   commission
-   status
-   notes

Everything references Reservation.

------------------------------------------------------------------------

# 8. Calendar

Views: - Month - Week - Timeline

Capabilities: - Drag & drop - Block dates - Maintenance blocks -
Conflict detection - Multi-property - Filters - Color by platform

Platforms: - Airbnb - Booking.com - Direct

------------------------------------------------------------------------

# 9. Finance

Existing modules remain.

Future revenue derives automatically from reservations.

Modules:

-   Revenue
-   Expenses
-   Loans
-   Cash Flow
-   P&L
-   Valuation
-   Forecasting
-   Marketing ROI

------------------------------------------------------------------------

# 10. Operations

Modules:

-   Housekeeping
-   Maintenance
-   Inventory
-   Laundry
-   Vendors
-   Staff Scheduling

Each operation links back to a Reservation when applicable.

------------------------------------------------------------------------

# 11. Communication

Support:

-   Email
-   WhatsApp
-   SMS
-   Push notifications

Automations:

-   Booking confirmation
-   Check-in
-   Check-out
-   Review request
-   Payment reminder

------------------------------------------------------------------------

# 12. AI

Capabilities:

-   Pricing recommendations
-   Occupancy forecasts
-   Expense anomaly detection
-   Property health score
-   Marketing ROI
-   Cash flow insights
-   Natural language reporting

AI never edits data directly.

------------------------------------------------------------------------

# 13. Integrations

Phase 1: - Airbnb - Booking.com

Later: - Expedia - Vrbo - Stripe - Razorpay - WhatsApp - Google
Calendar - Smart Locks

Use provider adapters.

------------------------------------------------------------------------

# 14. Coding Standards

-   Strict TypeScript
-   No any
-   Repository pattern
-   Business logic in services
-   Thin API routes
-   Zod validation
-   Unit tests
-   Feature flags for major changes

------------------------------------------------------------------------

# 15. Development Workflow

For every feature:

1.  Analyze existing implementation.
2.  Produce architecture plan.
3.  Produce migration plan.
4.  Wait for approval.
5.  Implement in small commits.
6.  Add tests.
7.  Update documentation.

------------------------------------------------------------------------

# 16. Phase Roadmap

## Phase 1

Reservation Engine Universal Calendar Availability Guest Model

## Phase 2

Airbnb Integration Booking.com Integration Channel Sync Background Jobs

## Phase 3

Guest CRM Messaging Documents Reviews

## Phase 4

Housekeeping Maintenance Inventory Vendors

## Phase 5

Automation WhatsApp Emails Notifications

## Phase 6

Revenue Intelligence Dynamic Pricing Forecasting

## Phase 7

Owner Portal 2.0 Benchmarks Investor Reports

## Phase 8

Enterprise SaaS Subscriptions Organizations White Label

## Phase 9

AI Copilot Predictive Insights Voice Queries

------------------------------------------------------------------------

# 17. Claude Instructions

Before changing code:

-   Read this document completely.
-   Review current implementation.
-   Preserve backward compatibility.
-   Never delete working functionality.
-   Explain architectural impacts before implementation.
-   Update this document whenever architecture changes.

For each phase produce:

-   Gap analysis
-   Database changes
-   API changes
-   UI changes
-   Risks
-   Migration plan
-   Testing strategy

Then implement incrementally.

------------------------------------------------------------------------

# 18. Immediate Priority

Build a universal reservation calendar.

Requirements:

-   Canonical Reservation entity
-   Multi-property calendar
-   Conflict detection
-   Availability engine
-   Manual reservations
-   Blocked dates
-   Airbnb sync
-   Booking.com sync
-   Reservation detail panel
-   Finance derived from reservation data

This becomes the foundation for every future module.
