# Accessibility

---

## Standard: WCAG 2.1 AA

All pages and components must meet WCAG 2.1 Level AA compliance.

---

## Key Requirements

### Keyboard Navigation
- All interactive elements reachable via Tab
- Logical tab order (matches visual order)
- Visible focus ring on all interactive elements (never remove `outline` without replacement)
- Modal dialogs trap focus (Radix UI handles this)
- Escape closes modals
- Enter submits focused button

```css
/* Ensure visible focus for keyboard users */
*:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}
```

### Color Contrast
- Normal text (< 18px): 4.5:1 minimum contrast ratio
- Large text (≥ 18px or ≥ 14px bold): 3:1 minimum
- UI components (buttons, inputs): 3:1 minimum

**Check:** Use Chrome DevTools accessibility panel or https://webaim.org/resources/contrastchecker/

Critical pair to verify: Green-600 (#16A34A) on white = 4.6:1 ✓

### Screen Readers
- All images have descriptive `alt` text
- Icons with no visible label have `aria-label`
- Status changes announced via `aria-live` regions
- Form errors linked to inputs via `aria-describedby`
- Tables have `<caption>` or `aria-label`

```tsx
// Icon button example
<button aria-label="Close reservation panel">
  <X className="h-4 w-4" aria-hidden="true" />
</button>

// Live region for status updates
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {statusMessage}
</div>
```

### Forms
- Every input has an associated `<label>`
- Error messages linked via `aria-describedby`
- Required fields marked with `aria-required="true"`
- Form submission feedback announced

```tsx
<div>
  <label htmlFor="guestEmail" className="block text-sm font-medium text-gray-700">
    Guest Email
  </label>
  <input
    id="guestEmail"
    type="email"
    aria-required="true"
    aria-invalid={!!errors.guestEmail}
    aria-describedby={errors.guestEmail ? 'guestEmail-error' : undefined}
    className="mt-1 block w-full rounded-md border border-gray-300"
  />
  {errors.guestEmail && (
    <p id="guestEmail-error" role="alert" className="mt-1 text-sm text-red-600">
      {errors.guestEmail.message}
    </p>
  )}
</div>
```

### Motion
- Respect `prefers-reduced-motion` media query
- No auto-playing animations
- Provide static alternatives to animated content

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

---

## Radix UI Accessibility

Radix UI primitives include ARIA attributes and keyboard support by default:
- `Dialog` — focus trap, Escape to close, aria-modal
- `Select` — keyboard navigation, aria-expanded
- `Tabs` — arrow key navigation, aria-selected
- `DropdownMenu` — keyboard navigation, role="menu"

Do NOT override these ARIA attributes unless you fully understand the implications.

---

## Testing

1. **Keyboard only test** — navigate entire flow using only Tab, Enter, Escape
2. **Screen reader test** — use VoiceOver (Mac) or NVDA (Windows) on key flows
3. **axe DevTools** — browser extension for automated checks
4. **Color contrast** — verify all text/background pairs

Run accessibility checks on every new feature before marking complete.
