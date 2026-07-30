// String permission codes used by the authorization layer.
//
// This file contains the permission code constants currently enforced by
// the application. The corresponding permission records are seeded via
// scripts/seed-permissions.ts.
//
// Add new permission constants incrementally as RBAC is implemented for
// additional modules.
//
// USER_REACTIVATE is intentionally omitted because there is currently no
// dedicated reactivation endpoint.

export const PermissionCodes = {
  ROLE_VIEW: "role.view",
  ROLE_CREATE: "role.create",
  ROLE_EDIT: "role.edit",
  ROLE_DELETE: "role.delete",

  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_EDIT: "user.edit",
  USER_DEACTIVATE: "user.deactivate",
  USER_PASSWORD_RESET_SEND: "user.password_reset.send",

  ENTITY_VIEW: "entity.view",
  ENTITY_CREATE: "entity.create",
  ENTITY_EDIT: "entity.edit",
  ENTITY_DELETE: "entity.delete",
  ENTITY_TOR_GENERATE: "entity.tor.generate",
  ENTITY_TOR_SETTINGS_MANAGE: "entity.tor.settings.manage",

  DIRECTOR_VIEW: "director.view",
  DIRECTOR_CREATE: "director.create",
  DIRECTOR_EDIT: "director.edit",
  DIRECTOR_DELETE: "director.delete",

  MEETING_VIEW: "meeting.view",
  MEETING_CREATE: "meeting.create",
  MEETING_EDIT: "meeting.edit",
  MEETING_RESOLUTION_CREATE: "meeting.resolution.create",
  MEETING_DOCUMENT_UPLOAD: "meeting.document.upload",

  CALENDAR_VIEW: "calendar.view",

  COMPLIANCE_VIEW: "compliance.view",
  COMPLIANCE_CREATE: "compliance.create",
  COMPLIANCE_EDIT: "compliance.edit",
  COMPLIANCE_DELETE: "compliance.delete",
  COMPLIANCE_IMPORT: "compliance.import",
  COMPLIANCE_CLEAR: "compliance.clear",
  COMPLIANCE_CALENDAR_IMPORT: "compliance.calendar.import",

  LICENSE_VIEW: "license.view",
  LICENSE_CREATE: "license.create",

  CAPITAL_VIEW: "capital.view",
  CAPITAL_EDIT: "capital.edit",
  CAPITAL_IMPORT: "capital.import",

  ALERT_VIEW: "alert.view",
  ALERT_UPDATE: "alert.update",
  ALERT_GENERATE: "alert.generate",

  DOCUMENT_VIEW: "document.view",
  DOCUMENT_UPLOAD: "document.upload",
  DOCUMENT_DELETE: "document.delete",

  SUBMISSION_VIEW: "submission.view",
  SUBMISSION_CREATE: "submission.create",
  SUBMISSION_APPROVE: "submission.approve",
  SUBMISSION_REJECT: "submission.reject",
  SUBMISSION_STATUS_UPDATE: "submission.status.update",

  ORGCHART_VIEW: "orgchart.view",

  DASHBOARD_VIEW: "dashboard.view",
} as const;
