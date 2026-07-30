// String permission codes used by the authorization layer.
//
// Roles and Users permissions are currently defined here, matching the
// permissions currently enforced by the application and seeded in
// scripts/seed-permissions.ts.
//
// Additional module permission codes should be added incrementally as
// authorization is implemented for each module.
//
// USER_REACTIVATE is intentionally omitted because there is currently
// no dedicated reactivation endpoint enforcing that permission.

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
} as const;
