# Responsive Design Rules

---

## Breakpoints

```
Mobile:  < 768px    (phones)
Tablet:  768–1024px (tablets, small laptops)
Desktop: > 1024px   (laptops, desktops)
```

---

## Layout by Screen Size

### Mobile (< 768px)
- Sidebar hidden by default → slide-over with hamburger button
- Bottom navigation bar: 5 primary icons (Calendar, Reservations, Finance, Operations, More)
- Single column layout
- Tables become card stacks
- Calendar: month view only (timeline too dense)
- Modals: full-screen bottom sheet

### Tablet (768–1024px)
- Sidebar collapsed to icon-only (no labels)
- Two-column layouts where applicable
- Calendar: month + timeline (limited properties)

### Desktop (> 1024px)
- Full sidebar with labels
- Multi-column layouts
- Full timeline calendar

---

## Responsive Patterns

### Table → Card Stack on Mobile

```tsx
// Desktop: data table with all columns
// Mobile: each row becomes a card

function ReservationList({ reservations }) {
  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable columns={columns} data={reservations} />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {reservations.map(r => (
          <ReservationCard key={r.id} reservation={r} />
        ))}
      </div>
    </div>
  );
}
```

### Responsive Grid

```tsx
// Properties dashboard
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {properties.map(p => <PropertyCard key={p.id} property={p} />)}
</div>
```

### Sidebar

```tsx
// DashboardShell.tsx
<div className="flex h-screen">
  {/* Desktop sidebar */}
  <aside className="hidden md:flex w-60 flex-col border-r bg-white">
    <Sidebar />
  </aside>

  {/* Mobile slide-over sidebar */}
  <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
    <SheetContent side="left" className="w-60 p-0">
      <Sidebar onNavigate={() => setSidebarOpen(false)} />
    </SheetContent>
  </Sheet>

  {/* Main content */}
  <main className="flex-1 overflow-auto">
    <Header onMenuClick={() => setSidebarOpen(true)} />
    <div className="p-4 md:p-6">{children}</div>
  </main>
</div>
```

---

## Touch Targets

All interactive elements on mobile must have minimum 44×44px touch target.

```css
/* Apply to all clickable elements used on mobile */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}
```

---

## Calendar Responsive Behavior

| View | Mobile | Tablet | Desktop |
|------|--------|--------|---------|
| Timeline | Hidden (too dense) | 7-day window | 30-day window |
| Month | Single property only | Multi-property | Multi-property |
| Week | Show | Show | Show |

Mobile calendar default: month view, single property (one the user selects from a dropdown).

---

## Housekeeping Mobile (Priority)

Housekeeping staff use mobile exclusively. Optimize:
- Large tap targets on checklist items
- Camera button prominent for photo upload
- Task status updates with single tap
- Works on 3G/poor connectivity (skeleton loading, optimistic updates)
- Supports swipe to complete task (Phase 5)
