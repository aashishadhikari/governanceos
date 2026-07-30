// Read-only verification: are existing users migrated to the RBAC roleId model?
// Run manually: npx tsx scripts/check-user-roleids.ts
//
// Makes no changes — only reads Users and Roles and prints a report. Used to
// decide whether scripts/backfill-user-roles.ts (not yet created) is needed
// before enforcing any API permission.

import 'dotenv/config';
import prisma from '../lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, roleId: true, isActive: true },
    orderBy: { email: 'asc' },
  });

  const withRoleId = users.filter((u) => u.roleId !== null);
  const withoutRoleId = users.filter((u) => u.roleId === null);

  console.log('=== User roleId migration status ===\n');
  console.log(`Total users:                 ${users.length}`);
  console.log(`With roleId set:             ${withRoleId.length}`);
  console.log(`Without roleId (null):       ${withoutRoleId.length}`);

  if (withoutRoleId.length > 0) {
    console.log('\n--- Users missing roleId (legacy enum role shown) ---');
    for (const u of withoutRoleId) {
      console.log(`  ${u.email.padEnd(35)} role=${u.role}  isActive=${u.isActive}`);
    }
  }

  if (withRoleId.length > 0) {
    console.log('\n--- Users with roleId already set ---');
    for (const u of withRoleId) {
      console.log(`  ${u.email.padEnd(35)} role=${u.role}  roleId=${u.roleId}  isActive=${u.isActive}`);
    }
  }

  const systemRoles = await prisma.role.findMany({
    where: { isSystem: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  console.log('\n=== System roles (name -> id, for backfill mapping) ===\n');
  for (const r of systemRoles) {
    console.log(`  ${r.name.padEnd(15)} -> ${r.id}`);
  }

  const expectedSystemRoles = ['Super Admin', 'Admin', 'Legal', 'Finance', 'Viewer'];
  const missing = expectedSystemRoles.filter(
    (name) => !systemRoles.some((r) => r.name === name)
  );
  if (missing.length > 0) {
    console.log(`\n⚠ Missing expected system role(s): ${missing.join(', ')}`);
    console.log('  A backfill mapping legacy role -> Role.id would fail for users on these roles.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
