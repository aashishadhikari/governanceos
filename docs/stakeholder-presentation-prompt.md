# Prompt: Revise the existing GovernanceOS stakeholder presentation

I've attached the current version of this deck (GovernanceOS-Platform-Evolution.pptx),
built from an earlier version of this brief. Please revise it into an updated
version with the changes below and produce a new .pptx file — keep the
existing visual style, color scheme, and slide template consistent
throughout. This is a revision of an existing deck, not a rebuild from
scratch, so preserve anything not explicitly called out below.

**Accuracy matters more than impact.** Several changes below soften a claim
to stay accurate (audit trail retrieval, document restore, Submissions email
routing, security readiness vs. certification). Keep those honesty caveats in
the final wording — don't let editing polish quietly erase them.

## 1. Renumbering (do this first — it affects every capability slide)

The deck currently labels slides "CAPABILITY X OF 9." Adding the new
Submissions capability (see below) makes it 10 total. Renumber every
"CAPABILITY X OF 9" label to "CAPABILITY X OF 10" and reorder them to match
the sequence implied below. The new Regulatory Capital slide is NOT a
numbered capability — it documents an existing, stable module rather than
new work — so label it "ALSO PART OF THE PLATFORM" instead of a number.

## 2. New slide — insert after "Where We Started," before "Six Weeks, By the Numbers"

**Also Part of the Platform — Regulatory Capital**
One-line description: Tracks whether every entity holds the regulatory
capital it's required to, and flags it the moment that's at risk.

This module existed before the six-week effort and saw the least change of
anything in the platform — worth describing on its own since it's core to
what regulated entities need:
- Tracks each entity's required minimum regulatory capital against its
  current balance, with an automatic buffer calculation and a clear flag
  the moment an entity dips below its minimum
- Tracks individual bank accounts per entity separately from the capital
  requirement itself
- Balances can be bulk-loaded from a spreadsheet, with a clear
  created/updated/skipped summary after each load
- Built, but not yet switched on: the platform is already built to receive
  balances directly from real banking/treasury systems — ready to connect
  when we choose to, not already happening today
- Every balance change, however it arrives, is captured in the audit trail

## 3. New capability slide — insert after the Regulatory Calendar capability slide

**Feedback & Improvement Tracking (Submissions)**
One-line description: Anyone using the platform can report a bug or request
an enhancement directly from within it — no separate ticketing tool, no
email chain.

Today:
- Any user can log a bug report or feature request from inside the
  platform, tagged with severity/priority and exactly where it happened
- Every submission is automatically tied to the real person who logged it —
  never anonymous, never spoofable
- Each submission moves through a clear review workflow: open → reviewed →
  approved or rejected → implemented
- The team is alerted the moment something is submitted

Keep as a "planned," not current, item: today that alert goes to one fixed
team channel. Routing it to a configurable point of contact by email, based
on what was submitted, is a planned next step, not built yet.

Suggested diagram: `User spots a bug or has an idea` → `Logs it directly in
the platform` → `Team is alerted immediately` → `Reviewed and moved through
the workflow` → `(Planned) routed by email to the right point of contact`

## 4. Revise the "Full Audit Trail & Compliance Readiness" slide

Replace any line claiming the trail is "available for compliance review at
any time" with the accurate version: "every action is permanently recorded
and ready to be reported on." Add one small note that a self-service audit
history viewer is a planned next step (also add this to the roadmap slide,
see #9 below) — the underlying data already fully supports it.

## 5. Revise the "Self-Service User & Document Management" slide

Replace the generic "no engineering ticket required" framing with these
three specific, verified examples of things that genuinely used to require
an engineer and now don't:
1. Who gets alerted about upcoming filings — used to mean editing a
   configuration file directly in the code; now it's a settings screen an
   admin edits themselves
2. Triggering the daily deadline check on demand — instead of asking
   engineering to run a script, there's now a "Send Alerts Now" button
3. What each role is allowed to do — used to be fixed in code, requiring a
   deployment to change; now fully managed through a Role Management
   screen, including cloning an existing role

Also revise the document-deletion line: deleting a document doesn't destroy
it immediately, but recovering one today still requires an administrator to
step in directly — there's no self-service "undo" yet. Phrase it as
"recoverable by an administrator, not gone forever," not as a one-click
self-service restore.

## 6. Revise the "Governance Automation & Notifications" slide

Add coverage of the notification bell: a single bell icon in the header on
every page shows a live count of everything pending. Clicking a
notification marks it read and takes the user straight to the relevant
page; one click clears everything once caught up. Nothing requires a page
refresh to notice.

## 7. Revise the Security Audit slide

Replace the "what we found and fixed" list framing with this OWASP / ISO
27001 / SOC 2 Type II readiness table:

| Security Area (OWASP) | What We Did | Maturity Signal |
|---|---|---|
| Broken Access Control | Closed a gap letting one employee view another's account details; every module now enforces role-based permissions | ISO 27001 & SOC 2 — Access Control |
| Authentication Failures | Closed a flaw that could reveal pending account invitations; hardened session handling | ISO 27001 & SOC 2 — Identity & Access Management |
| Security Misconfiguration | Added automatic account lockout after repeated failed logins; added standard web security protections platform-wide | ISO 27001 & SOC 2 — Secure Configuration |
| Insecure Design (system connections) | Automated jobs and external system connections now authenticate independently, never relying on someone being logged in | SOC 2 — System Operations |
| Logging & Monitoring | Verified no sensitive data (passwords, keys) is ever exposed in logs or responses; every action remains traceable | ISO 27001 & SOC 2 — Logging & Monitoring |
| Vulnerable Components | Every software component checked against public vulnerability records and updated | SOC 2 — Vulnerability Management |
| Unsafe File Uploads | Document vault restricted to safe, expected file types only | ISO 27001 — Secure Development |
| Production Readiness | An issue silently blocking deployment was found and fixed before it could delay launch | Both — Change Management |

Closing line, keep the wording exactly this careful: "GovernanceOS's
technical security controls are now aligned with the foundations ISO 27001
and SOC 2 Type II both require. Formal certification requires a separate
external audit — a natural next step once we choose to pursue it — but the
underlying technical work is already in place." Do not state or imply the
platform is already certified to either standard — this is readiness, not
certification.

## 8. Revise the "Cleanly Retired an Unfinished Integration" slide

Rename and reframe as **"Built for Future Integrations, Not Left
Half-Finished."** Same underlying story (a broken third-party
project-tracking connection was disabled cleanly, control still visible in
the UI), but the emphasis should be that the platform is built to support
this kind of integration when it's time — not that the idea is gone. Avoid
the words "retired" or "removed" in the slide text; use "disabled."

## 9. Update the "What's Next" roadmap slide

Add two items to the existing roadmap: a self-service audit history viewer,
and Submissions email routing to a configurable point of contact.

## 10. Add one backup/appendix slide, for Q&A only — not part of the main flow

**How Obligations, the Calendar, Alerts, and Notifications Relate**
Compliance Obligations is the master list of what's due; the Regulatory
Calendar is a way to load a lot of them in at once from a spreadsheet, not a
separate list; Alerts is a shared noticeboard at the entity level watching
every deadline across Compliance, Licenses, Capital, and Board Meetings;
Notifications is a personal nudge (in-app + email) sent to the specific
person responsible, currently only for compliance filings. Place this last,
after the closing/Q&A slide, and note it's a backup slide only used if
asked.

## Output

Produce an updated .pptx file with all of the above applied, not just a
written description of the changes.
