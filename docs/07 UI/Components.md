# Component Library

---

## Component Inventory

### Primitive Components (components/ui/)
| Component | Purpose | Status |
|-----------|---------|--------|
| Button | All buttons | Exists (implied) |
| Badge | Status/channel labels | Build |
| Input | Text input | Build |
| Select | Dropdown select | Radix-based |
| Dialog | Modal dialogs | Radix-based |
| Tabs | Tab navigation | Radix-based |
| Skeleton | Loading placeholder | Build |
| Table | Data table | Build |
| Pagination | Page controls | Build |
| Calendar (primitive) | Date picker | Build |
| Toast | Notifications | Sonner |
| Tooltip | Hover hints | Radix-based |
| Avatar | User/property avatar | Build |
| Breadcrumb | Navigation path | Build |

---

## Feature Components

### ReservationCalendar

The most complex component in the app.

```tsx
// components/calendar/ReservationCalendar.tsx

type View = 'timeline' | 'month' | 'week';

interface ReservationCalendarProps {
  properties: Property[];
  reservations: Reservation[];
  blocks: CalendarBlock[];
  view: View;
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  onReservationClick: (reservation: Reservation) => void;
  onBlockCreate: (propertyId: string, startDate: Date, endDate: Date) => void;
  onReservationMove?: (id: string, newCheckIn: Date) => void;
  isLoading?: boolean;
}
```

**Timeline View Implementation:**
- Each property = one row
- Dates = columns (one per day for the visible range)
- Reservation spans = absolutely positioned colored div across date columns
- Click on empty date = open "Create reservation / Block dates" modal
- Drag reservation edge = resize dates
- Uses CSS Grid for date columns

```tsx
// Timeline row for one property
function PropertyTimelineRow({ property, events, dateRange, onEventClick }) {
  const days = eachDayOfInterval(dateRange);

  return (
    <div className="relative grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))` }}>
      {days.map(day => (
        <div key={day.toISOString()} className="h-10 border-r border-gray-100" />
      ))}
      {events.map(event => (
        <ReservationSpan
          key={event.id}
          event={event}
          days={days}
          onClick={() => onEventClick(event)}
        />
      ))}
    </div>
  );
}
```

---

### ReservationDetail (Side Panel)

Slides in from the right when a reservation is clicked.

```tsx
// components/reservation/ReservationDetail.tsx

interface ReservationDetailProps {
  reservation: Reservation | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onCancel: (id: string) => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
}

// Sections:
// 1. Header: Guest name, channel badge, status badge
// 2. Dates: Check-in → Check-out, nights count
// 3. Guests: Adults + children + pets
// 4. Finance: Nightly rate, cleaning fee, gross, commission, net
// 5. Contact: Guest phone, email (click to call/WhatsApp)
// 6. Notes: Internal notes
// 7. Events: Status change history
// 8. Actions: Edit, Cancel, Check In, Check Out
```

---

### FinanceSummaryCard

```tsx
// components/finance/FinanceSummaryCard.tsx
interface FinanceSummaryCardProps {
  title: string;
  value: number;
  previousValue?: number;  // For trend indicator
  currency?: string;
  isLoading?: boolean;
}
// Shows: formatted value + trend arrow (up/down % vs previous month)
```

---

### PropertyCard

```tsx
// components/property/PropertyCard.tsx
interface PropertyCardProps {
  property: Property;
  stats?: {
    occupancyRate: number;
    currentMonthRevenue: number;
    activeReservations: number;
  };
  onClick: () => void;
}
// Dashboard grid card showing property thumbnail, name, and KPIs
```

---

### HousekeepingBoard

```tsx
// components/operations/HousekeepingBoard.tsx
// Kanban-style board: Pending | Assigned | In Progress | Completed
// Each column shows task cards
// Drag-and-drop (Phase 5)
```

---

### StatusTimeline

```tsx
// components/shared/StatusTimeline.tsx
// Shows a list of reservation events as a vertical timeline
// Used in ReservationDetail to show status history
interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  actor?: string;
  icon?: React.ReactNode;
}
```

---

## State Management

**TanStack Query (React Query)** for all server state.

```typescript
// Hooks pattern — one custom hook per domain entity

// hooks/useReservations.ts
export function useReservations(propertyId?: string, opts?: QueryOptions) {
  return useQuery({
    queryKey: ['reservations', propertyId, opts],
    queryFn: () => api.reservations.list({ propertyId, ...opts }),
    staleTime: 30_000,  // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.reservations.create,
    onSuccess: (newReservation) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
```

---

## API Client

```typescript
// lib/api/client.ts

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error.error?.message ?? 'Request failed', response.status, error.error?.code);
    }

    return response.json();
  }

  reservations = {
    list: (params?: Record<string, unknown>) =>
      this.request<PaginatedResult<Reservation>>(`/reservations?${new URLSearchParams(params as Record<string, string>)}`),
    create: (input: CreateReservationInput) =>
      this.request<Reservation>('/reservations', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: UpdateReservationInput) =>
      this.request<Reservation>(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    cancel: (id: string, reason: string) =>
      this.request<Reservation>(`/reservations/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  };

  // ... other domains
}

export const api = new ApiClient();
```
