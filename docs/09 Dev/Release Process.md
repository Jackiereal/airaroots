# Release Process

---

## Branch Strategy

```
main          ← production (Vercel auto-deploys)
staging       ← staging environment
feature/*     ← feature branches (e.g., feature/phase-1-reservations)
fix/*         ← bug fixes
migration/*   ← database migration branches
```

---

## Development Flow

```
1. Create feature branch from main
   git checkout -b feature/phase-1-reservations

2. Develop and commit in small increments
   git commit -m "feat(reservation): add conflict detection service"

3. Run checks before push
   npm run build          # Must pass
   tsc --noEmit           # Must pass
   npm test               # Must pass

4. Push branch
   git push origin feature/phase-1-reservations

5. Create PR to staging
   - Title: "feat: Phase 1 reservation engine"
   - Include: what changed, how to test, migration notes

6. Test on staging
   - Apply migration to staging Supabase
   - Verify feature works end-to-end
   - Check mobile
   - Run through Definition of Done

7. Merge to staging (after verification)

8. Create PR from staging → main
   - Review: no new TypeScript errors, no broken tests

9. Merge to main → Vercel deploys to production

10. Apply migration to production Supabase
    (Never auto-apply migrations — always manual verification)

11. Smoke test production
    - Create a test reservation
    - Verify calendar shows it
    - Verify finance updated
    - Delete test reservation
```

---

## Database Migration Process

**Never auto-run migrations on production.**

```bash
# Local development
supabase db push           # Apply local migrations

# Staging
supabase db push --db-url $STAGING_DB_URL

# Production (manual verification required)
# 1. Review migration SQL one more time
# 2. Check for any data-destructive operations
# 3. Run on production during low-traffic window
# 4. Monitor for 15 minutes after
supabase db push --db-url $PRODUCTION_DB_URL
```

---

## Hotfix Process

For production bugs that must be fixed immediately:

```
1. Create fix branch from main (not staging)
   git checkout -b fix/reservation-conflict-bug main

2. Fix the bug
3. Test locally
4. Push and create PR directly to main
5. Apply to production after review
6. Cherry-pick to staging: git cherry-pick <commit>
```

---

## Environment Variables

| Variable | Required | Where |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Vercel env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Vercel env |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Vercel env (server only) |
| `ANTHROPIC_API_KEY` | Phase 6 | Vercel env |
| `INTERAKT_API_KEY` | Phase 5 | Vercel env |
| `AIRBNB_WEBHOOK_SECRET` | Phase 2 | Vercel env |
| `BOOKING_COM_WEBHOOK_SECRET` | Phase 2 | Vercel env |
| `RAZORPAY_KEY_ID` | Phase 8 | Vercel env |
| `RAZORPAY_KEY_SECRET` | Phase 8 | Vercel env |
| `RAZORPAY_WEBHOOK_SECRET` | Phase 8 | Vercel env |
| `STRIPE_SECRET_KEY` | Phase 8 | Vercel env |
| `STRIPE_WEBHOOK_SECRET` | Phase 8 | Vercel env |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Phase 8 | Vercel env (public) |

---

## Versioning

Semantic versioning: `MAJOR.MINOR.PATCH`

| Change type | Version bump |
|-------------|-------------|
| Phase completion | MINOR (0.1.0 → 0.2.0) |
| Bug fix | PATCH (0.1.0 → 0.1.1) |
| Breaking API change | MAJOR (0.1.0 → 1.0.0) |

Version stored in `package.json`. Tag releases in Git.

```
git tag -a v0.1.0 -m "Phase 1: Reservation Engine"
git push origin v0.1.0
```

---

## Monitoring After Release

After every production deployment:
1. Check Vercel function logs for 500 errors
2. Check Supabase logs for slow queries or errors
3. Verify background jobs are processing
4. Check channel sync status (if Phase 2+)
5. Confirm no new TypeScript or build warnings

Alert threshold: >1% API error rate → investigate immediately.
