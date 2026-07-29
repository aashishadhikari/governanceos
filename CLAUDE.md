# GovernanceOS — Scope Definition
 
GovernanceOS is a **Corporate Entity Governance platform** — not a generic 
Governance, Risk & Compliance (GRC) platform.
 
Its sole purpose is to manage legal entities and the governance data 
associated with them across multiple jurisdictions.
 
# In Scope (IMPORTANT)
## Entity Management
- Legal Entity Registry
- Corporate Structure
- Ownership Structure
- Share Capital
- Registered Offices

## Governance
- Director Registry
- Board Committees
- Board Meetings
- Board Resolutions
- Governance Documents
- Organizational Documents

## Regulatory
- Regulatory Calendar
- Regulatory Obligations
- License Management
- Regulatory Capital

## Platform
- Audit Trail
- Notifications
- Dashboard
- Search
- Reporting
 
## Out of Scope
Unless the user explicitly asks for them, never introduce:
- Enterprise GRC
- Enterprise Risk Registers
- Operational Risk
- Risk Assessments
- Control Testing
- Control Libraries
- Internal Audit Management
- Policy Management
- Vendor Risk
- Third Party Risk
- Cybersecurity Compliance
- ISO 27001 modules
- SOC2 modules
- NIST modules
- Incident Management
- Business Continuity Management
- Vulnerability Management
- Asset Management
- Privacy Management
- ESG Management
 
 ## This project is an MVP.
Rules:
- One feature at a time.
- Never refactor unrelated code.
- Modify the minimum number of files.
- Reuse existing components.
- Follow existing code style.
- Follow existing API route patterns.
- Reuse existing modal/dialog components.
- Reuse audit logging.
- Reuse Prisma query style.
- Do not invent new architecture.
- Explain changes before editing.
- Never touch unrelated modules.

Before implementing:
1. Inspect similar implementation.
2. Reuse patterns.
3. Keep changes incremental.

# IMPORTANT NOTE
Stay out of scope unless the user explicitly requests them by name.
This project is frequently confused with GRC software.
Do not assume this project is a Governance, Risk & Compliance platform.
Always treat it as Corporate Entity Management software unless explicitly instructed otherwise.