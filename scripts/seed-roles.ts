import 'dotenv/config';
import prisma from '../lib/prisma';

async function main() {
  const roles = [
    {
      name: 'Super Admin',
      description: 'Full system access',
      isSystem: true,
    },
    {
      name: 'Admin',
      description: 'Administrative operations',
      isSystem: true,
    },
    {
      name: 'Legal',
      description: 'Legal & governance operations',
      isSystem: true,
    },
    {
      name: 'Finance',
      description: 'Finance operations',
      isSystem: true,
    },
    {
      name: 'Viewer',
      description: 'Read-only access',
      isSystem: true,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        name: role.name,
      },
      update: {},
      
      create: role,
    });
  }

  console.log('✅ System roles seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });