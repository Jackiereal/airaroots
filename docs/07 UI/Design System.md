# Design System

---

## Foundation

Built on **Tailwind CSS v4** + **Radix UI** primitives. No third-party component library (no shadcn copy-paste needed — build from scratch using Radix + Tailwind).

---

## Color Palette

```css
/* globals.css — CSS custom properties */
:root {
  /* Brand */
  --color-brand-primary: #16A34A;      /* Green-600 — primary actions */
  --color-brand-primary-hover: #15803D; /* Green-700 */
  --color-brand-accent: #22C55E;        /* Green-500 — highlights */

  /* Neutrals */
  --color-gray-50:  #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;

  /* Semantic */
  --color-success: #22C55E;    /* green-500 */
  --color-warning: #F59E0B;    /* amber-500 */
  --color-error:   #EF4444;    /* red-500 */
  --color-info:    #3B82F6;    /* blue-500 */

  /* Channel Colors */
  --color-channel-airbnb:   #FF5A5F;
  --color-channel-booking:  #003580;
  --color-channel-direct:   #22C55E;
  --color-channel-hold:     #6B7280;
  --color-channel-maintenance: #F59E0B;
}
```

---

## Typography

```css
/* Font stack */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Scale */
--text-xs:   0.75rem;   /* 12px */
--text-sm:   0.875rem;  /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg:   1.125rem;  /* 18px */
--text-xl:   1.25rem;   /* 20px */
--text-2xl:  1.5rem;    /* 24px */
--text-3xl:  1.875rem;  /* 30px */
```

---

## Spacing

8px base unit. All spacing is multiples of 4px (Tailwind default).

Key layout values:
- Sidebar width: 240px
- Content max-width: 1280px
- Mobile breakpoint: 768px
- Card padding: 16px (p-4)
- Section spacing: 24px (space-y-6)

---

## Core Components

### Button

```tsx
// components/ui/button.tsx

import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-green-600 text-white hover:bg-green-700',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        outline: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
        ghost: 'text-gray-700 hover:bg-gray-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        link: 'text-green-600 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3',
        default: 'h-9 px-4',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);
```

### Badge (Channel / Status)

```tsx
// components/ui/badge.tsx

const channelColors = {
  airbnb: 'bg-[#FF5A5F]/10 text-[#FF5A5F] border-[#FF5A5F]/20',
  booking_com: 'bg-blue-50 text-blue-800 border-blue-200',
  direct: 'bg-green-50 text-green-800 border-green-200',
  vrbo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

const statusColors = {
  confirmed: 'bg-green-50 text-green-800',
  checked_in: 'bg-blue-50 text-blue-800',
  checked_out: 'bg-gray-50 text-gray-800',
  cancelled: 'bg-red-50 text-red-800',
  conflict: 'bg-amber-50 text-amber-800',
};
```

### Data Table

```tsx
// components/ui/data-table.tsx
// Wraps Tanstack Table v8 with standard Airaroots styling
// - Sticky header
// - Sortable columns
// - Pagination controls
// - Row selection
// - Loading skeleton
// - Empty state
```

### Loading Skeleton

Always use skeleton loaders — never spinners for content areas.

```tsx
// components/ui/skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-gray-100', className)} />
  );
}

// Usage patterns:
<Skeleton className="h-4 w-32" />           // Text line
<Skeleton className="h-20 w-full" />         // Card
<Skeleton className="h-64 w-full" />         // Chart placeholder
```

---

## Layout System

### Dashboard Shell

```
┌─────────────────────────────────────────────┐
│  Header (56px)                               │
│  [Logo] [Property Selector] [User Menu]      │
├──────────┬──────────────────────────────────┤
│          │                                  │
│ Sidebar  │  Main Content Area               │
│ (240px)  │  (padding: 24px)                 │
│          │                                  │
│ Nav items│  <page content>                  │
│          │                                  │
└──────────┴──────────────────────────────────┘

Mobile (<768px):
- Sidebar collapses to bottom navigation (5 icons)
- Header shows hamburger to slide out sidebar
```

### Page Header Pattern

```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
  </div>
  <div className="flex gap-2">
    {/* Action buttons */}
  </div>
</div>
```

---

## Form Patterns

All forms use **React Hook Form** + **Zod** resolver:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateReservationSchema, type CreateReservationInput } from '@/domains/reservation/schema';

const form = useForm<CreateReservationInput>({
  resolver: zodResolver(CreateReservationSchema),
  defaultValues: {
    channel: 'direct',
    adults: 1,
    children: 0,
  },
});
```

Inline validation — show errors on blur, not submit:
```tsx
<input
  {...form.register('guestEmail')}
  onBlur={() => form.trigger('guestEmail')}
/>
{form.formState.errors.guestEmail && (
  <p className="text-sm text-red-600">{form.formState.errors.guestEmail.message}</p>
)}
```

---

## Modal Pattern

```tsx
// Use Radix Dialog for all modals
import * as Dialog from '@radix-ui/react-dialog';

export function ReservationModal({ open, onOpenChange, propertyId }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-full max-w-lg z-50 p-6">
          <Dialog.Title className="text-lg font-semibold mb-4">New Reservation</Dialog.Title>
          {/* form content */}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

## Toast Notifications

```tsx
// Use a lightweight toast library (Sonner or react-hot-toast)
// Standard patterns:

toast.success('Reservation created successfully');
toast.error('Failed to create reservation. Check dates for conflicts.');
toast.loading('Syncing channel...'); // Returns ID for dismissal
toast.promise(
  createReservation(data),
  {
    loading: 'Creating reservation...',
    success: 'Reservation created!',
    error: (err) => err.message,
  }
);
```
