// One-time backfill: assigns roleId to users created before the Role/
// RolePermission model existed (prisma/seed.ts, scripts/create-admin.ts),
// so the authorization engine (lib/auth/permissions.ts) can resolve their
// permissions instead of treating them as having none.
//
// Run manually: npx tsx scripts/backfill-user-roles.ts
//
// Idempotent — only touches users where roleId is currently null. Users
// that already have a roleId are left completely untouched (not read from,
// not written to), and only the roleId field is ever updated — every other
// field on a user is left exactly as it was.

import 'dotenv/config';
import prisma from '../lib/prisma';
import type { UserRole } from '@prisma/client';

const SYSTEM_ROLE_NAME_BY_LEGACY_ENUM: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  legal: 'Legal',
  finance: 'Finance',
  viewer: 'Viewer',
};

async function main() {
  // Load all five system roles by name and validate none are missing
  // before making any updates.
  const systemRoles = await prisma.role.findMany({
    where: { isSystem: true },
    select: { id: true, name: true },
  });

  const roleIdByName = new Map(systemRoles.map((r) => [r.name, r.id]));

  const requiredNames = Object.values(SYSTEM_ROLE_NAME_BY_LEGACY_ENUM);
  const missingRoleNames = requiredNames.filter((name) => !roleIdByName.has(name));

  if (missingRoleNames.length > 0) {
    throw new Error(
      `Cannot run backfill: missing required system role(s): ${missingRoleNames.join(', ')}. ` +
      `Run scripts/seed-roles.ts first, then retry.`
    );
  }

  // Snapshot the already-migrated count before making any changes, so the
  // "skipped" figure in the summary reflects users that already had a
  // roleId prior to this run — not ones this run is about to set.
  const alreadyMigratedCount = await prisma.user.count({
    where: { roleId: { not: null } },
  });

  const usersMissingRoleId = await prisma.user.findMany({
    where: { roleId: null },
    select: { id: true, email: true, role: true },
    orderBy: { email: 'asc' },
  });

  console.log('=== User roleId backfill ===\n');

  let updated = 0;
  let errors = 0;

  for (const user of usersMissingRoleId) {
    const roleName = SYSTEM_ROLE_NAME_BY_LEGACY_ENUM[user.role];
    const roleId = roleName ? roleIdByName.get(roleName) : undefined;

    if (!roleId) {
      console.error(
        `  ✗ ${user.email.padEnd(35)} legacy role "${user.role}" has no matching system role — skipped.`
      );
      errors++;
      continue;
    }

    // Only roleId is written — every other field on the user is untouched.
    await prisma.user.update({
      where: { id: user.id },
      data: { roleId },
    });

    console.log(
      `  ✓ ${user.email.padEnd(35)} legacy role=${user.role.padEnd(12)} -> ${roleName.padEnd(12)} (roleId=${roleId})`
    );
    updated++;
  }

  const skipped = alreadyMigratedCount;

  console.log('\n=== Summary ===');
  console.log(`Users updated: ${updated}`);
  console.log(`Users skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
