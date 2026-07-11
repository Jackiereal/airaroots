# Airaroots QA test matrix

## 1. Auth / signup flow
- 1.1 Sign up new email -> lands on /onboarding
- 1.2 Sign in existing user -> routes to /dashboard (has property_access) or /client/dashboard (none)
- 1.3 Sign out -> redirected to signin, protected routes bounce back to signin

## 2. Property CRUD (org-staff / property-admin)
- 2.1 Create property -> appears in /properties and /dashboard immediately (auto-grant)
- 2.2 Edit property -> saves
- 2.3 Delete property -> removed from list

## 3. Property-level access control (the core fix)
- 3.1 User with NO grant on a property -> /properties/[id] redirects to /client/dashboard, API returns 403/404
- 3.2 User with 'client' grant -> can view finance/ops data, cannot write (403 on POST/PATCH/DELETE)
- 3.3 User with 'admin' grant -> full read/write on that property only
- 3.4 Admin on property A cannot see property B (no grant there)
- 3.5 Grant/revoke via admin/property-access endpoint works, takes effect immediately

## 4. Finance module
- 4.1 View summary for a property
- 4.2 Add expense, add direct booking, add loan -> shows in list
- 4.3 CSV import
- 4.4 Historical averages / projections load

## 5. Calendar
- 5.1 /dashboard/calendar shows reservations + blocks for accessible properties
- 5.2 Create manual block
- 5.3 Create reservation via modal

## 6. Reservations
- 6.1 /dashboard/reservations lists reservations
- 6.2 Reservation detail page loads, check-in/check-out actions work

## 7. Channels (Airbnb sync)
- 7.1 /dashboard/channels shows connections
- 7.2 Sync now -> success, log recorded
- 7.3 iCal export URL resolves

## 8. Operations
- 8.1 Housekeeping: task list loads, create task, mark complete
- 8.2 Maintenance: request list, create request
- 8.3 Vendors: list (org-wide + property-scoped), create vendor
- 8.4 Inventory: item list, add transaction

## 9. Client portal
- 9.1 /client/dashboard shows only granted properties
- 9.2 /client/properties/[id] read-only P&L view, no edit controls

## 10. Regression / cross-cutting
- 10.1 No console errors on any page load
- 10.2 RLS recursion fix holds (calendar/reservations show data, not empty)
- 10.3 Admin/users page loads (even if role toggle is inert)
