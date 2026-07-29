// Assigns default permission sets to the five built-in system roles.
// Run manually: npx tsx scripts/seed-role-permissions.ts
//
// Idempotent — safe to re-run; existing RolePermission rows are matched on the
// (roleId, permissionId) composite unique key and left untouched.
//
// System roles are platform-managed defaults, not customer-editable. Custom
// (isSystem: false) roles are never queried or written by this script.

import 'dotenv/config';
import prisma from '../lib/prisma';

// A role's permission set is described as one of:
//  - a list of modules  -> every permission in those modules
//  - "all"              -> every permission that currently exists
//  - "view-only"        -> every permission whose code ends with ".view"
type RoleRule =
  | { modules: string[] }
  | { all: true }
  | { viewOnly: true };

const ROLE_RULES: Record<string, RoleRule> = {
  // ── Super Admin — unrestricted platform access ──────────────────────────────
  'Super Admin': { all: true },

  // ── Admin — operational administrator ───────────────────────────────────────
  // Gets every module that exists today. No platform.* permissions exist yet,
  // so Admin is identical to Super Admin for now — expected to diverge once
  // platform-level permissions are introduced (see docs/security/03-system-roles.md).
  'Admin': { all: true },

  // ── Legal — legal & governance functions ────────────────────────────────────
  // No Regulatory Capital, no platform administration (Users/Roles), no
  // Submissions triage, no Alerts.
  'Legal': {
    modules: [
      'dashboard',
      'entities',
      'org-chart',
      'governance-team',
      'board-meetings',
      'calendar',
      'compliance',
      'licenses',
      'document-vault',
    ],
  },

  // ── Finance — regulatory capital & compliance-adjacent functions ────────────
  // No entity/governance data entry, no Licenses, no platform administration.
  'Finance': {
    modules: [
      'dashboard',
      'regulatory-capital',
      'compliance',
      'document-vault',
      'alerts',
      'calendar',
    ],
  },

  // ── Viewer — strictly read-only ──────────────────────────────────────────────
  // Every *.view permission across every module, nothing else.
  'Viewer': { viewOnly: true },
};

async function resolvePermissionIds(rule: RoleRule): Promise<string[]> {
  if ('all' in rule) {
    const permissions = await prisma.permission.findMany({ select: { id: true } });
    return permissions.map(p => p.id);
  }

  if ('viewOnly' in rule) {
    const permissions = await prisma.permission.findMany({
      where: { code: { endsWith: '.view' } },
      select: { id: true },
    });
    return permissions.map(p => p.id);
  }

  const permissions = await prisma.permission.findMany({
    where: { module: { in: rule.modules } },
    select: { id: true },
  });
  return permissions.map(p => p.id);
}

async function assignRole(roleName: string, rule: RoleRule): Promise<{ roleName: string; assigned: number }> {
  // Resolve the role by name — never by a hardcoded id.
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    console.warn(`Role "${roleName}" not found — skipping. Run scripts/seed-roles.ts first.`);
    return { roleName, assigned: 0 };
  }

  // Resolve permissions by code/module — never by a hardcoded id.
  const permissionIds = await resolvePermissionIds(rule);

  await prisma.$transaction(
    permissionIds.map(permissionId =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      })
    )
  );

  return { roleName, assigned: permissionIds.length };
}

async function main() {
  const results: { roleName: string; assigned: number }[] = [];

  for (const [roleName, rule] of Object.entries(ROLE_RULES)) {
    results.push(await assignRole(roleName, rule));
  }

  const nameWidth = Math.max(...results.map(r => r.roleName.length));
  console.log('Role permission assignment complete:\n');
  for (const r of results) {
    console.log(`${r.roleName.padEnd(nameWidth)} : ${r.assigned}`);
  }

  const total = await prisma.rolePermission.count();
  console.log(`\nTotal RolePermission records: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
