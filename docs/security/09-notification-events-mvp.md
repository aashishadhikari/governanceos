# Notification Events MVP — Board Meetings, Regulatory Calendar, Compliance, User Management

**Status:** Done. Builds on `08-notification-platform.md` (Phase 1–2: model, service, Submissions integration). This document covers the next increment — integrating four additional business events into the same platform — plus the alert-engine dedup fix and wording pass that followed manual testing.

## What shipped

| Event | Trigger | Recipient | `NotificationType` | Email |
|---|---|---|---|---|
| User role changed | `PATCH /api/users/[id]` | The affected user (`id` param — already a `User.id`, no resolution needed) | `USER_ROLE_CHANGED` (new) | No |
| Meeting invitation | Attendee row created (`POST /api/board-meetings`, `PATCH /api/board-meetings/[id]`) | `Director.email → User.email` | `MEETING_ASSIGNED` (reused, previously defined/unused) | Yes |
| Filing due soon / overdue | Existing `generateAlerts()` day-threshold check | `ComplianceObligation.owner` (free text) → resolved | `FILING_DEADLINE` (new, one type for both urgencies) | Yes |
| New obligation assigned | `POST /api/compliance` (manual create) | `ComplianceObligation.owner` → resolved | `TASK_ASSIGNED` (reused, previously defined/unused) | Yes |

Two `NotificationType` values and one `NotificationEntityType` value were added (`USER_ROLE_CHANGED`, `FILING_DEADLINE`, `USER`) — purely additive enum changes, migration `20260731061457_add_role_and_filing_notification_types`. No table/column changes.

## New shared code

- `lib/notifications/resolveRecipient.ts` — `resolveUserByEmailOrName()` (email first, name fallback — `User.name` isn't unique, documented tech debt) and `resolveUserByEmail()` (Director → User; most directors have no platform login, silent skip is expected). Extracted from the Submissions route's local `resolveSubmitterId()` once 3+ call sites needed the same lookup.
- `lib/notifications/meetingInvitations.ts` — `notifyInvitedDirectors()`, shared by both board-meeting routes.
- `lib/email/templates/notification.ts` + `sendNotificationEmail()` (`lib/email/email-service.ts`) — one generic parameterized email template shared by all three email-producing events, same convention as the existing `buildInvitationEmail`.

## Meeting invitation — attendee diffing

`PATCH /api/board-meetings/[id]` always receives the *full* current invitee list on every edit (the edit form resubmits it unconditionally, even for unrelated changes like the meeting time), and the route always does `deleteMany` + `createMany` to sync attendees. Naively notifying "on attendee row created" would re-notify every existing attendee on every edit. Fixed by snapshotting the attendee set before the delete and diffing against the new list — only directors absent from the "before" set are notified. Verified: new meeting notifies everyone; unrelated edits notify no one; adding one attendee notifies only that one; removing attendees notifies no one.

## Filing Due Soon / Overdue — dedup design (the part that needed a real fix)

**Original design mistake:** the personal notification was gated by the `Alert` model's own dedup (`entityId, category, relatedId, status in [unread, read]`), which exists for the org-wide Alert's purposes, not the personal notification's. This caused two real bugs, found in manual testing:

1. **Escalation suppressed** — only one `AlertCandidate` is generated per obligation per run. If an earlier lower-urgency Alert (e.g. the 90-day info bucket) was still unread/read, the Alert-level dedup blocked the *entire* candidate — including the later, more urgent due-soon/overdue notification — from ever being evaluated.
2. **Dismiss re-arms notifications** — dismissing an Alert removes it from the dedup set, so the next `generateAlerts()` run would recreate the Alert *and* re-fire a duplicate personal notification/email for an unchanged due date.

**Fix:** `maybeNotifyFilingDeadline()` (`lib/alertEngine.ts`) dedupes independently, directly against the `Notification` table, scoped by `(recipientId, type: FILING_DEADLINE, entityType: COMPLIANCE_OBLIGATION, entityId, metadata.urgency)` via a Postgres JSON-path filter on `metadata`. It runs on every candidate regardless of whether the Alert row itself was (re)created that pass. This means:
- A due-soon notification already sent never blocks a later, distinct overdue notification (different `urgency` value).
- Repeated runs at the *same* urgency never re-notify, independent of whether the underlying Alert was read or dismissed in between.

**A second gap found in this same function during manual testing:** `createNotification()` and `sendNotificationEmail()` were both textually placed after the same dedup check, but were independent fire-and-forget calls with no dependency on each other — the email could in principle fire without a corresponding persisted notification (a slow/failed write, or a race). Fixed by `await`ing `createNotification()` inside a `try/catch` and only sending the email on success — one dedup decision, one success gate, not two parallel actions that happen to sit next to each other.

**Verified against live data (obligation `test 2026Again`):** Alert dismissed and recreated three separate times across the session; exactly one `overdue`-urgency `FILING_DEADLINE` notification exists throughout — dismissing the Alert never re-triggers the notification or email.

**Known pre-existing quirk, not introduced by this work:** `daysUntil()` zeroes `now` in the server's local timezone and compares against a UTC-midnight `dueDate`. A due date entered as "yesterday" can compute to exactly `0` (due-soon) rather than a negative number (overdue) depending on the server's clock/timezone at the moment `generateAlerts()` runs. Not fixed — this helper is shared by three other alert categories (licenses, capital, meetings) and touching it was out of scope for this increment.

## Wording pass (no behavior change)

Following manual testing feedback, notification titles were updated so the business object (obligation name, meeting) is visible in the bell without opening the message — previously only the generic type ("Filing due soon") was in the title, making multiple notifications of the same type indistinguishable at a glance:

| Type | Title before | Title after |
|---|---|---|
| `FILING_DEADLINE` | `Filing due soon` / `Filing overdue` | `Filing due soon: {requirementType}` / `Filing overdue: {requirementType}` |
| `TASK_ASSIGNED` | `Task assigned` | `Task assigned: {requirementType}` (falls back to generic if not provided) |
| `MEETING_ASSIGNED` | `Meeting assigned` | `Meeting assigned: {meetingTitle}` (falls back to generic if not provided) |
| `USER_ROLE_CHANGED` | — | Message now names the exact role via the existing `ROLE_LABELS` map (`lib/db/users.ts`) and states re-login is required, not optional — JWT sessions bake `role` in at sign-in (`lib/auth/config.ts`), so a mid-session role change has no effect until the next login. |

Alerts page: the "Dismiss" button was renamed **"Dismiss for now"** with a native tooltip ("Alerts reappear until the underlying issue is resolved.") — manual testing showed users read "Dismiss" as permanent removal, which doesn't match the recreate-while-unresolved behavior. Label and tooltip only; `handleDismiss()`'s API call (`PATCH /api/alerts`, `status: 'dismissed'`) is unchanged.

## Deliberately not implemented (would require a new schema/workflow)

Per the MVP scope agreement, these were investigated and explicitly deferred rather than half-built:

- **Agenda published / Minutes published** — no discrete "publish" event exists; agenda/minutes are plain fields edited via the same generic meeting PATCH as everything else.
- **Board Action Item assigned** — `MeetingResolution` has no assignee field; would require a real schema change.
- **Evidence requested / uploaded** — no evidence model or fields exist anywhere in the schema.
- **Document approval requested** — `Document` has no approver/approval-status field; the schema-free option (a transient `approverId` in the upload payload, no persisted state) was scoped but not built this pass.
- **Compliance legacy-alert migration** (`/api/notifications/tasks` retirement) — still pending per `08-notification-platform.md`'s Phase 3, untouched by this work.

## Files touched this increment

`prisma/schema.prisma` (+migration), `lib/notifications/templates.ts`, `lib/notifications/resolveRecipient.ts` (new), `lib/notifications/meetingInvitations.ts` (new), `lib/email/templates/notification.ts` (new), `lib/email/email-service.ts`, `lib/email/index.ts`, `lib/alertEngine.ts`, `app/api/users/[id]/route.ts`, `app/api/board-meetings/route.ts`, `app/api/board-meetings/[id]/route.ts`, `app/api/compliance/route.ts`, `app/alerts/AlertsClient.tsx`.
