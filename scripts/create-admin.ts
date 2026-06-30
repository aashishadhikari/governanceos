import 'dotenv/config';

console.log(process.env.DATABASE_URL);

import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';

async function main() {
    const passwordHash = await bcrypt.hash('Password123', 10);

    await prisma.user.upsert({
        where: {
            email: 'admin@test.com',
        },
        update: {
            passwordHash,
            isActive: true,
            mustChangePassword: false,
            role: UserRole.super_admin,
        },
        create: {
            name: 'System Administrator',
            email: 'admin@test.com',
            passwordHash,
            role: UserRole.super_admin,
            isActive: true,
            mustChangePassword: false,
            failedLoginAttempts: 0,
        },
    });

    console.log('Admin user created/updated successfully.');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });