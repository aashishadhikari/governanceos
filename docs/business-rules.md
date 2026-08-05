# GovernanceOS — Business Rules Reference

A catalog of the concrete thresholds, formulas, and workflow rules implemented in code, organized by module. This is not a design document — it's a reference for "what number/rule is actually enforced, and where." Where a rule lives in exactly one place, the file/line is given so it can be verified directly rather than trusted secondhand.

This complements `docs/security/01`–`09`, which cover the RBAC/permission model and notification platform design — those aren't repeated here except where a numeric rule sits inside them.

---

## 1. Compliance Obligations & Regulatory Calendar

Regulatory Calendar is not a separate model — it's `ComplianceObligation` rows with `source: 'calendar'` (bulk-imported) vs `'manual'` (created via the UI). Both are subject to the same rules below.

- **Due-date urgency thresholds** (`lib/alertEngine.ts`, compliance loop): relative to `dueDate`, using calendar-day difference (`daysUntil()`, server-local midnight vs UTC-midnight `dueDate` — see caveat in §9):
  - `< 0` days → **overdue**, severity `critical`
  - `0–30` days → **due soon**, severity `critical`
  - `31–60` days → severity `warning`
  - `61–90` days → severity `info`
  - `> 90` days → no alert
- **Personal notification** (`FILING_DEADLINE`) only fires for the **overdue** and **due-soon (≤30 day)** buckets — the 60/90-day buckets produce an org-wide `Alert` only, no personal notification/email. (`lib/alertEngine.ts`, `maybeNotifyFilingDeadline`)
- **New Obligation Assigned** notification (`TASK_ASSIGNED`) fires once, immediately, at creation (`POST /api/compliance`) — independent of due-date bucket.
- `owner` is a free-text `String`, not a `User` foreign key. Recipient resolution is best-effort: exact email match, then name match (`User.name` is not unique — first match wins, non-deterministic if names collide). No match → silently skip, never guess.
- Marking `status: 'completed'` without an explicit `completedAt`/`submittedDate` auto-stamps both to "now" if not already set (`app/api/compliance/[id]/route.ts`).
- **`ComplianceObligation.status` is never automatically changed by the alert engine.** A due date lapsing does *not* flip `status` to `overdue` automatically — that field only changes via an explicit `PATCH` from the Compliance UI. The "overdue" *Alert*/*notification* and the obligation's own `status` field are two independent things.

## 2. Licenses

Same day-threshold structure as Compliance, applied to `expiryDate` (`lib/alertEngine.ts`, license loop):
- `< 0` days → **expired**, `critical`
- `0–30` days → `critical`
- `31–60` → `warning`
- `61–90` → `info`

Only licenses with `status IN ('active', 'pending_renewal')` are scanned — `expired`/`suspended` licenses are not re-alerted. **`renewalLeadDays` (default 90) and `renewalRequired` are stored but not currently used to gate or suppress alert generation** — every active/pending-renewal license with an `expiryDate` is scanned at the fixed 30/60/90 thresholds regardless of these fields' values.

## 3. Regulatory Capital

Coverage ratio = `currentBalance / minimumRequired` (`lib/alertEngine.ts`):
- `< 1.0` → **breach**, `critical`
- `1.0–1.19` → **below buffer**, `warning`
- `≥ 1.2` → no alert

`bufferPercentage` defaults to `20` on the model but the breach/buffer thresholds above are hardcoded (`1`, `1.2`), not read from that field.

## 4. Board Meetings

- **Quorum**: `quorumRequired` defaults to `3`. Enforced only as a UI hint (green "quorum satisfied" / amber "below quorum" banner in the meeting form) — not enforced server-side; a meeting can be saved with fewer invitees than `quorumRequired`.
- **Upcoming-meeting reminder** (`lib/alertEngine.ts`): only for `status: 'scheduled'` meetings, `0–14` days out — severity `warning` if `≤ 7` days, else `info`. No alert for meetings further than 14 days out, and no alert for a `scheduled` meeting whose date has already passed without being marked `completed`/`cancelled`.
- **Meeting invitation notification** fires only for newly-added attendees — see `09-notification-events-mvp.md` for the diffing logic (the edit form resubmits the full invitee list on every save, including unrelated edits).
- **Resolution status** (`proposed`/`passed`/`defeated`/`deferred`) is manually selected — there is no vote-count-based auto-determination from `votesFor`/`votesAgainst`/`votesAbstain`.
- Editing a meeting's `invitedDirectors` list **always deletes and recreates all attendee rows**, which resets every attendee's RSVP `status` back to `invited` — even for directors who had already `accepted`/`declined`, and even when the edit didn't touch the invitee list's *content* (pre-existing behavior).

## 5. Entity Health Score

`computeHealthScore()` (`lib/alertEngine.ts`), weighted average, `0–100`:

| Component | Weight | Formula |
|---|---|---|
| Compliance | 40% | `100 − (overdue/total)×60 − (pending/total)×20` |
| Licenses | 25% | `100 − (expired/total)×70 − (expiringSoon/total)×20` (expiring soon = expires within 0–90 days) |
| Capital | 20% | ratio `< 1` → `0`; `< 1.1` → `40`; `< 1.2` → `70`; else `100` |
| Meetings | 15% | `100`, unless the entity has ≥1 meeting **and** none `completed` in the trailing 6 months → `40`. An entity with **zero** meetings ever is not penalized. |

Any component with zero relevant records (e.g. no compliance obligations) defaults to a perfect sub-score for that component, not zero.

## 6. Notifications Platform

(Full design in `08-notification-platform.md` / `09-notification-events-mvp.md` — rules only, here.)

- **Ownership, not RBAC, gates `/api/me/notifications`.** A user always sees notifications addressed to them, even if their role no longer grants `*.view` on the parent module.
- `title`/`message`/`url` are generated once at creation time and stored — never recomputed on read, so a later actor-name change never rewords historical notifications.
- `recipientId` cascades on delete; `actorId` sets null on delete — deleting a recipient wipes their notification history; deleting an actor just anonymizes past notifications.
- **`FILING_DEADLINE` dedup is scoped to `(recipientId, entityId, urgency)`**, checked directly against the `Notification` table — independent of the `Alert` model's own lifecycle (dismissing/reading an Alert never re-arms a personal notification for an unchanged urgency; escalating from due-soon to overdue always produces a new notification since urgency differs).
- The legacy `/api/notifications/tasks` feed and the new `/api/me/notifications` feed run in parallel, merged only for bell display — not a shared data model. Legacy items have no read-state; badge count = legacy item count + unread platform count.

## 7. Authentication & Sessions

- **Sessions are JWT-based, 8-hour `maxAge`** (`lib/auth/config.ts`). `role`/`roleId` are written into the token only at sign-in (`jwt` callback's `if (user)` branch) — **a role change made mid-session has no effect until the next login**, regardless of what the database says in the meantime.
- Invitation and password-reset links expire in **24 hours** (`lib/email/templates/invitation.ts`).
- New users default to `mustChangePassword: true` and `failedLoginAttempts: 0` on creation/invitation/setup.

## 8. Documents

- **Versioning**: creating a document with the same `name` for the same `entityId` (ignoring soft-deleted rows) auto-increments `version`; otherwise starts at `1`. Keyed on exact name match, not content hash.
- **Soft delete only** — `deletedAt`/`deletedBy` are set, the row is never physically removed; all list/version queries filter `deletedAt: null`.
- No approval workflow exists on the `Document` model (no approver, no approval status field) as of this writing.

## 9. Search

- Minimum query length: **2 characters** (shorter returns an empty result set, no query executed).
- Each result category (entities, directors, documents, meetings) is independently gated by that category's `*.view` permission — a user missing `document.view` gets zero document results, not an error.
- Each category is capped at **8 results**.

## 10. Audit Log

- Append-only; `writeAuditLog`/`writeRequestAuditLog` swallow their own failures (`console.error`, no throw) — **an audit-log write failure never blocks the business operation it's logging.**
- `writeRequestAuditLog` auto-captures the acting user, IP (`x-forwarded-for`/`x-real-ip`), and User-Agent from the request — callers never pass these manually.

## 11. Known cross-cutting caveats (not bugs, but worth knowing)

- **`daysUntil()` timezone boundary** (`lib/alertEngine.ts`, shared by §1, §2, §4): compares a UTC-midnight `dueDate`/`expiryDate` against `now` zeroed in the *server's local timezone*. A date entered as "yesterday" can compute to exactly `0` days (not negative) depending on the server clock/timezone at evaluation time. Affects the due-soon/overdue boundary for compliance, licenses, and the overdue path specifically.
- **Free-text ownership fields** (`ComplianceObligation.owner`, historically `Submission.submittedBy`) are resolved to a `User` best-effort (email, then non-unique name) everywhere they're used for notifications — never guessed, silently skipped on no match. This is documented, deliberate tech debt, not scheduled for a schema fix in the current MVP scope.
