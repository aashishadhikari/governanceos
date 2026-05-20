import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// One-time migration: rename legacy "Senior Employee" variants → "Officer"
// Hit GET /api/admin/migrate-director-roles to run it.
// Safe to run multiple times (WHERE clause is idempotent).
export async function GET() {
  try {
    const result = await prisma.$executeRaw`
      UPDATE "directors"
      SET    role = 'Officer',
             "updatedAt" = NOW()
      WHERE  role ILIKE '%senior employee%'
         OR  role = 'Vice President (Senior Employee)'
    `;

    return NextResponse.json({
      ok: true,
      rowsUpdated: result,
      message: `Migrated ${result} director record(s) from Senior Employee → Officer`,
    });
  } catch (err) {
    console.error('[migrate-director-roles]', err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
