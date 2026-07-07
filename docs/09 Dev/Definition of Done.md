# Definition of Done

> Every task must meet ALL of these criteria before marking as complete.
> No exceptions. No "we'll fix it later."

---

## Code Quality

- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
- [ ] No `any` types introduced
- [ ] No unused imports or variables
- [ ] No `console.log` in production code (use logger)
- [ ] No hardcoded strings that should be constants
- [ ] No TODO comments left in committed code (convert to GitHub issues)

---

## Testing

- [ ] Unit tests written for all new service methods
- [ ] Integration tests written for all new API routes
- [ ] All existing tests still pass
- [ ] RLS policies tested (verify cross-org data isolation)
- [ ] Edge cases covered: empty data, null values, boundary dates

---

## Security

- [ ] All inputs validated with Zod before use
- [ ] No raw user input passed to SQL queries
- [ ] No sensitive data logged (emails, tokens, IDs)
- [ ] RLS enabled on all new tables
- [ ] Auth check at start of every API route

---

## Database

- [ ] Migration file created with IF NOT EXISTS guards
- [ ] All new tables have `organization_id` (or documented reason why not)
- [ ] RLS policies added for all new tables
- [ ] Indexes added for all foreign keys and commonly filtered columns
- [ ] `updated_at` trigger added for mutable tables
- [ ] Migration tested on staging before production

---

## API

- [ ] Response follows standard shape `{ data: T }` or `{ error: { code, message } }`
- [ ] All status codes correct (201 for create, 200 for get/update, 204 for delete)
- [ ] Pagination on all list endpoints
- [ ] Route handler error wrapper used
- [ ] JSDoc comment on route function

---

## UI

- [ ] Loading state shown for all async operations
- [ ] Error state with actionable message shown when async fails
- [ ] Empty state shown when list is empty
- [ ] Works on 375px screen (mobile)
- [ ] No accessibility violations (run axe DevTools check)
- [ ] Focus management correct for modals (focus trapped, Escape closes)

---

## Events & Jobs

- [ ] Domain events emitted for all state changes
- [ ] Background jobs for async operations (not blocking HTTP request)
- [ ] Job handlers have error handling and retry logic

---

## Documentation

- [ ] New domain files updated if architecture changed
- [ ] API routes documented with JSDoc
- [ ] If this changes an existing behavior: document the migration impact

---

## Checklist Before Opening PR / Marking Done

```
□ tsc --noEmit passes
□ Tests pass locally
□ Tested manually on localhost
□ Tested on staging with real data
□ Mobile tested at 375px
□ No regressions on existing features
□ Handbook updated if architecture changed
```

---

## What "Not Started" vs "Done" Looks Like

| Status | Meaning |
|--------|---------|
| Not Started | No code written |
| In Progress | Code written, tests not passing or not on staging |
| Staged | On staging, being validated |
| Done | All DoD criteria met, on production (or merged to main) |

Never mark something "Done" because the happy path works. The feature must work including error states, edge cases, and mobile.
