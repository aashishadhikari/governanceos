# Security Verification Report — Post-Hardening

**Status:** Done. Independent verification of the OWASP hardening pass documented informally in the `security: OWASP hardening pass` commit (access control, M2M auth, headers, deps). This is a point-in-time report, not a living document — re-run this exercise after any further auth/RBAC/upload changes rather than editing this file in place.

**Methodology:** live testing against the running dev server, not a code-read exercise. Created 6 disposable test users (one per role — Super Admin, Admin, Legal, Finance, Viewer — plus one with `passwordHash: null` to probe the invited-but-inactive state), obtained real session cookies via the actual NextAuth credentials flow, and drove every endpoint with `curl`, attempting to bypass each control rather than assuming the implementation was correct. All test users and test data were deleted afterward. Sections 6–8 (error handling, logging, dependencies) were pure static analysis and were independently forked in parallel rather than live-tested.

---

## Critical findings (discovered and fixed during this verification)

| # | Finding | Severity | Root cause | Fix |
|---|---|---|---|---|
| 1 | Production build completely broken | Critical | Three independent causes: `app/api/webhooks/jira/route.ts` imported 4 functions that never existed in `lib/jiraEntityMap.ts` (present since the initial commit); a nullable-`passwordHash` type error in `lib/auth/config.ts`; a `Document` type mismatch in `app/documents/page.tsx` | Jira route removed per product decision (see `docs/business-rules.md` and the Jira sections of `README.md`/`SETUP.md` for the decommission); `passwordHash` fixed as part of #2; `Document` type fixed in a follow-up pass (`lib/db/schema.ts` was missing the `fileName` field that the Prisma model and `getDocuments()` already had) |
| 2 | Account enumeration via invited-but-inactive users | High | `bcrypt.compare(password, null)` throws `"data and hash arguments required"`, which leaked into the login redirect URL — distinguishable from the generic `CredentialsSignin` shown for wrong-password/unknown-email | `lib/auth/config.ts` `authorize()` now returns `null` (same generic path) when `!user.passwordHash`, before ever calling `bcrypt.compare` |
| 3 | `GET /api/users/[id]` had no authorization check at all | High | Missed in the original hardening pass — any authenticated user, any role, could fetch any other user's full record including `passwordHash` | Added `authorizeRequest(PermissionCodes.USER_VIEW)` |
| 4 | `passwordHash` returned in API responses and written into the audit trail | High | `app/api/users/route.ts` (POST) and `app/api/users/[id]/route.ts` (GET/PATCH/DELETE) all passed the full Prisma `User` object — hash included — into both the HTTP response and `writeRequestAuditLog`'s `oldValues`/`newValues` | All four routes now strip `passwordHash` before it leaves the server, logged or not |
| 5 | Two raw-error leaks missed by the original hardening pass | Medium | `app/api/webhooks/jira/route.ts:308` (now moot, file removed) and `app/api/compliance/route.ts:144` returned `err.message` directly with no guard | Both now return a generic message; full detail still logged server-side |
| 6 | `DATABASE_URL` (with embedded DB password) printed to stdout | Medium | `scripts/create-admin.ts:3` — unconditional `console.log(process.env.DATABASE_URL)` | Line deleted |

---

## Confirmed passing (live-tested)

**Authorization matrix.** `/api/users`, `/api/users/[id]`, `/api/entities`, `/api/directors`, `/api/capital`, `/api/compliance`, `/api/documents`, `/api/roles`, `/api/board-meetings`, `/api/documents/upload`, `/api/admin/dri-config`, `/api/admin/migrate-director-roles` tested against unauthenticated + all 5 roles (66 requests). Every result matched the DB-seeded permission grants exactly, including negative cases that would catch a real bug: Finance cannot view Entities/Directors, Legal cannot view Capital, Finance and Legal cannot view Roles. No horizontal or vertical privilege escalation found. IDOR check: bogus IDs correctly produce 403 (wrong permission) vs. 404 (right permission, no such record) — the permission check runs before any object lookup everywhere tested.

**Machine-to-machine auth.** `bank-sync` rejects no-key, wrong-key, *and a fully valid browser session with no key* (401 in all three cases). `cron/dri-alerts`'s dual-mode design verified live: no secret + no permission → 403; no secret + `ALERT_GENERATE` permission → 200 (the "Send Alerts Now" button path); wrong secret → 403.

**Security headers.** Confirmed absent in dev by design. The `headers()` function in `next.config.ts` is production-gated pure logic with no other dependency, verified independent of the (then-)broken build. **Follow-up done:** the build now succeeds cleanly (see `docs/security` notes above / commit history), so a one-time `curl -D -` against a real production deployment to visually confirm header values is worth doing but is no longer blocked.

**Authentication.**
- Cookies: `HttpOnly`, `SameSite=Lax`, correct 8h `Expires`, `Secure` correctly absent in dev / present-by-config in production.
- Logout: session check returns empty after sign-out; protected pages correctly redirect afterward.
- Lockout: 5 wrong attempts → 6th attempt (even with the *correct* password) returns `AccountLocked`, not `CredentialsSignin`.
- **Recommendation (no change made):** keep permanent, admin-unlock lockout rather than a timed cooldown. A timed window needs a new `lockedUntil` timestamp column and migration; this is an internal tool where admin-assisted unlock (via the existing "resend invitation" flow, which already clears the counter) is low-friction; and a fixed cooldown is easier for an attacker to simply wait out. Revisit if self-service unlock becomes a real friction point.

**File upload.** `.svg`, `.exe`, `.docm`, `.xlsm`, `.pptm`, and double-extension (`resume.pdf.exe`) all rejected with 400. Oversized file (11MB against a 10MB configured limit) → 413. Legitimate `.pdf` → 201. Path traversal via a crafted filename override verified via code re-read rather than live tooling: `path.basename()` strips directory components and the subsequent `[^a-zA-Z0-9_-]` regex whitelist strips any remaining `/`/`..` characters — double-protected by construction.

**Regression.** As Super Admin: Users, Entities, Directors, Board Meetings (list + new), Compliance, Key Dates/Calendar, Alerts, Notifications, Documents, Regulatory Capital, Cron Jobs, and Bank Sync all return 200/expected status on both page routes and their backing API routes. Jira Sync was intentionally decommissioned in a follow-up task (see `README.md`/`SETUP.md`) — the button is now visibly disabled rather than silently broken.

---

## Error handling (Section 6 — forked, static analysis)

20 API route files checked. The 5 files fixed in the original hardening pass hold up under re-verification. One new Medium finding (`compliance/route.ts`, folded into the table above) was found and fixed. The broader `err instanceof Error ? err.message : 'fallback'` pattern across ~11 other routes was assessed as Low risk / acceptable — real Prisma error text for common failures (unique constraint, foreign key, not-found) reveals field names, not schema/SQL/credentials. No route anywhere returns a raw error object directly (`JSON.stringify(err)`/direct passthrough: zero occurrences).

## Logging (Section 7 — forked, static analysis)

All 5 previously-claimed debug-log removals re-verified by reading current file contents. No secret values (`NEXTAUTH_SECRET`, `CRON_SECRET`, API keys, JWTs) are logged anywhere in the codebase. The two new findings (`DATABASE_URL` logging, `passwordHash` in the audit trail) are in the table above.

## Dependencies (Section 8 — forked, static analysis)

Re-ran `npm audit` independently: matched the claimed 15 vulnerabilities (0 critical, 5 high, 10 moderate) exactly. `next@16.3.0` confirmed outside the vulnerable range for the Turbopack proxy-bypass CVE (GHSA-6gpp-xcg3-4w24). `xlsx` (client-side only, `RegulatoryCalendarClient.tsx`) and `nodemailer` (the vulnerable `envelope` parameter is never set anywhere in this codebase) reachability claims both re-confirmed correct. All build-tool-only chains (brace-expansion, fast-uri, js-yaml, postcss) confirmed to terminate in devDependencies with no runtime path. Bonus finding acted on: `drizzle-kit`/`drizzle-orm` were also completely unused (this app is Prisma-only) — removed, dropping the count to 13 vulnerabilities (0 critical, 5 high, 8 moderate).

---

## Summary

| Category | Count |
|---|---|
| Critical (fixed) | 1 (broken production build) |
| High (fixed) | 4 |
| Medium (fixed) | 2 |
| Needs review | Re-visually-confirm production headers now that the build succeeds |

**Files touched during verification:** `app/api/compliance/route.ts`, `app/api/users/route.ts`, `app/api/users/[id]/route.ts`, `app/api/webhooks/jira/route.ts` (deleted), `app/compliance/ComplianceClient.tsx`, `instrumentation.ts`, `lib/auth/config.ts`, `proxy.ts`, `scripts/create-admin.ts`, `package.json`/`package-lock.json` (drizzle removal).

## Follow-up (resolved in a subsequent pass)

The one outstanding item from this report — the `app/documents/page.tsx` build blocker — was root-caused and fixed: `lib/db/schema.ts`'s hand-written `Document` interface was missing the `fileName` field already present on the Prisma model and already returned by `getDocuments()`. Added the missing field; no `any`/`@ts-ignore` used. `npx tsc --noEmit` and `npm run build` are both clean as of that fix. The Jira integration referenced throughout this report has since been fully decommissioned as an active feature (routes, sync logic, and dead helpers removed; UI placeholder kept disabled) — see `README.md` and `SETUP.md` for current status.
