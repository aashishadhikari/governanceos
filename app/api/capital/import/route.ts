/**
 * POST /api/capital/import
 *
 * Accepts a multipart/form-data CSV upload for bank accounts. Header row
 * required, columns:
 *
 *   entityId            (required) existing Entity.id
 *   bankName            (required)
 *   accountNumber       (required) used as dedupe key with entityId
 *   currency            (required) 3-letter code
 *   balance             (required) number
 *   minRequiredBalance  (optional) number, default 0
 *   notes               (optional)
 *
 * Rows whose (entityId, accountNumber) already exist are UPDATED in place;
 * new rows are CREATED. Unknown entityIds are skipped.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseCsv } from '@/lib/csv';
// Preferred helper for API routes.
// Automatically records the authenticated user,
// client IP address and browser User-Agent.
import { writeRequestAuditLog } from '@/lib/audit';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';

export async function POST(request: Request) {
  try {
    const denied = await authorizeRequest(PermissionCodes.CAPITAL_IMPORT);
    if (denied) return denied;

    const form = await request.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing "file" field in multipart upload.' },
        { status: 400 },
      );
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV is empty or missing a header row.' },
        { status: 400 },
      );
    }

    const entities = await prisma.entity.findMany({ select: { id: true } });
    const entityIds = new Set(entities.map((e) => e.id));

    const results: Array<{ row: number; status: 'created' | 'updated' | 'skipped'; message?: string }> = [];
    let created = 0;
    let updated = 0;

    for (let idx = 0; idx < rows.length; idx += 1) {
      const r = rows[idx];
      const lineNo = idx + 2;

      const entityId = r.entityId;
      const bankName = r.bankName;
      const accountNumber = r.accountNumber;
      const currency = r.currency;
      const balanceRaw = r.balance;

      if (!entityId || !bankName || !accountNumber || !currency || !balanceRaw) {
        results.push({
          row: lineNo,
          status: 'skipped',
          message: 'Missing required column (entityId, bankName, accountNumber, currency, balance).',
        });
        continue;
      }

      if (!entityIds.has(entityId)) {
        results.push({ row: lineNo, status: 'skipped', message: `Unknown entityId: ${entityId}` });
        continue;
      }

      const balance = Number(balanceRaw);
      if (Number.isNaN(balance)) {
        results.push({ row: lineNo, status: 'skipped', message: `Invalid balance: ${balanceRaw}` });
        continue;
      }
      const minRequired = r.minRequiredBalance ? Number(r.minRequiredBalance) : 0;
      if (Number.isNaN(minRequired)) {
        results.push({
          row: lineNo,
          status: 'skipped',
          message: `Invalid minRequiredBalance: ${r.minRequiredBalance}`,
        });
        continue;
      }

      try {
        const existing = await prisma.bankAccount.findFirst({
          where: { entityId, accountNumber },
        });

        if (existing) {
          const updatedRow = await prisma.bankAccount.update({
            where: { id: existing.id },
            data: {
              bankName,
              currency,
              balance,
              minRequiredBalance: minRequired,
              notes: r.notes || existing.notes,
              lastUpdated: new Date(),
            },
          });
          updated += 1;
          results.push({ row: lineNo, status: 'updated' });
          // Record the bank account update performed via CSV import.
          // The authenticated user is captured automatically.
          await writeRequestAuditLog(request, {
            action: 'UPDATE',
            tableName: 'bank_accounts',
            recordId: updatedRow.id,
            entityId,
            oldValues: existing,
            newValues: updatedRow,
            notes: `CSV import — row ${lineNo}`,
          });
        } else {
          const newRow = await prisma.bankAccount.create({
            data: {
              entityId,
              bankName,
              accountNumber,
              currency,
              balance,
              minRequiredBalance: minRequired,
              notes: r.notes || null,
            },
          });
          created += 1;
          results.push({ row: lineNo, status: 'created' });
          // Record the bank account creation performed via CSV import.
          // The authenticated user is captured automatically.
          await writeRequestAuditLog(request, {
            action: 'CREATE',
            tableName: 'bank_accounts',
            recordId: newRow.id,
            entityId,
            newValues: newRow,
            notes: `CSV import — row ${lineNo}`,
          });
        }
      } catch (err) {
        results.push({
          row: lineNo,
          status: 'skipped',
          message: err instanceof Error ? err.message : 'Database error',
        });
      }
    }

    return NextResponse.json({
      totalRows: rows.length,
      created,
      updated,
      skipped: rows.length - created - updated,
      results,
    });
  } catch (err) {
    console.error('[POST /api/capital/import]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    );
  }
}
