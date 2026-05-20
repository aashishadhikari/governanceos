/**
 * POST /api/compliance/calendar
 *
 * Import regulatory calendar entries from a JSON body.
 * Accepts the same shape produced by the Excel parser:
 *
 *   {
 *     year: 2026,
 *     entries: [
 *       {
 *         country, jurisdiction, entity_name, regulator,
 *         report_name, frequency, deadline_raw, due_date,
 *         recurrence, lead_team, compliance_dri, finance_dri
 *       }, …
 *     ]
 *   }
 *
 * Entity matching: fuzzy — normalise both sides (lower, strip punctuation),
 * try exact then contains. Unmatched entries are recorded in `skipped`.
 *
 * GET /api/compliance/calendar?year=2026
 * Returns all calendar-sourced obligations for a given year, grouped by
 * jurisdiction.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ── helpers ───────────────────────────────────────────────────────────────────

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Best-effort fuzzy match of entity_name → Entity.id */
function matchEntity(
  entityName: string,
  entities: { id: string; name: string }[],
): string | null {
  const n = norm(entityName);
  // 1. exact
  const exact = entities.find(e => norm(e.name) === n);
  if (exact) return exact.id;
  // 2. one contains the other
  const partial = entities.find(e => norm(e.name).includes(n) || n.includes(norm(e.name)));
  if (partial) return partial.id;
  return null;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;

  try {
    const where: Record<string, unknown> = { source: 'calendar' };
    if (year) where.calendarYear = year;

    // Use raw SQL to avoid TS errors before `prisma generate` is re-run
    const rows = year
      ? await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT co.*, e.name AS "entityName", e.country AS "entityCountry"
          FROM compliance_obligations co
          JOIN entities e ON e.id = co."entityId"
          WHERE co.source = 'calendar' AND co."calendarYear" = ${year}
          ORDER BY co."dueDate" ASC
        `
      : await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT co.*, e.name AS "entityName", e.country AS "entityCountry"
          FROM compliance_obligations co
          JOIN entities e ON e.id = co."entityId"
          WHERE co.source = 'calendar'
          ORDER BY co."dueDate" ASC
        `;

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/compliance/calendar]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

interface CalendarEntry {
  country?: string;
  jurisdiction?: string;
  entity_name: string;
  regulator: string;
  report_name: string;
  frequency?: string;
  deadline_raw?: string;
  due_date: string;
  recurrence?: string;
  lead_team?: string;
  compliance_dri?: string;
  finance_dri?: string;
}

interface ImportPayload {
  year: number;
  entries: CalendarEntry[];
  replaceExisting?: boolean; // default false — upsert mode
}

export async function POST(request: Request) {
  try {
    const body: ImportPayload = await request.json();
    const { year, entries, replaceExisting = false } = body;

    if (!year || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'Payload must have year (number) and entries (array).' },
        { status: 400 },
      );
    }

    const entities = await prisma.entity.findMany({ select: { id: true, name: true } });

    // Optional: clear existing calendar entries for this year before re-import
    if (replaceExisting) {
      await prisma.$executeRaw`
        DELETE FROM compliance_obligations
        WHERE source = 'calendar' AND "calendarYear" = ${year}
      `;
    }

    // Load existing calendar rows for this year (for upsert logic)
    const existingCalRows = await prisma.$queryRaw<Array<{ id: string; "entityId": string; "requirementType": string }>>`
      SELECT id, "entityId", "requirementType"
      FROM compliance_obligations
      WHERE source = 'calendar' AND "calendarYear" = ${year}
    `;
    const existingMap = new Map(
      existingCalRows.map(r => [`${r.entityId}::${r.requirementType.trim().toLowerCase()}`, r.id]),
    );

    const results: Array<{ row: number; status: string; message?: string }> = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const lineNo = i + 1;

      const entityId = matchEntity(entry.entity_name, entities);
      if (!entityId) {
        results.push({ row: lineNo, status: 'skipped', message: `No entity match for: "${entry.entity_name}"` });
        skipped++;
        continue;
      }

      const dueDate = new Date(entry.due_date);
      if (isNaN(dueDate.getTime())) {
        results.push({ row: lineNo, status: 'skipped', message: `Invalid due_date: ${entry.due_date}` });
        skipped++;
        continue;
      }

      const driNote = [
        entry.compliance_dri ? `Compliance DRI: ${entry.compliance_dri}` : '',
        entry.finance_dri ? `Finance DRI: ${entry.finance_dri}` : '',
      ].filter(Boolean).join(' | ');

      const description = [entry.frequency, entry.deadline_raw].filter(Boolean).join(' · ');
      const requirementType = entry.report_name;
      const recurrence = entry.recurrence ?? 'annual';
      const owner = entry.lead_team ?? 'Compliance';
      const regulator = entry.regulator;

      const dedupeKey = `${entityId}::${requirementType.trim().toLowerCase()}`;
      const existingId = existingMap.get(dedupeKey);

      try {
        if (existingId && !replaceExisting) {
          // Update
          await prisma.$executeRaw`
            UPDATE compliance_obligations SET
              regulator       = ${regulator},
              description     = ${description},
              "dueDate"       = ${dueDate},
              owner           = ${owner},
              notes           = ${driNote},
              recurrence      = ${recurrence},
              "calendarYear"  = ${year},
              "updatedAt"     = NOW()
            WHERE id = ${existingId}
          `;
          results.push({ row: lineNo, status: 'updated' });
          updated++;
        } else {
          // Create — use a generated cuid-like id via gen_random_uuid() isn't available everywhere
          // so we generate in Node
          const newId = crypto.randomUUID ? crypto.randomUUID() : `cal_${Date.now()}_${i}`;
          await prisma.$executeRaw`
            INSERT INTO compliance_obligations
              (id, "entityId", "requirementType", regulator, description,
               "dueDate", status, owner, notes, recurrence, source, "calendarYear",
               "createdAt", "updatedAt")
            VALUES
              (${newId}, ${entityId}, ${requirementType}, ${regulator}, ${description},
               ${dueDate}, 'pending', ${owner}, ${driNote}, ${recurrence}, 'calendar', ${year},
               NOW(), NOW())
          `;
          existingMap.set(dedupeKey, newId);
          results.push({ row: lineNo, status: 'created' });
          created++;
        }
      } catch (err) {
        results.push({ row: lineNo, status: 'skipped', message: String(err) });
        skipped++;
      }
    }

    return NextResponse.json({
      year,
      totalRows: entries.length,
      created,
      updated,
      skipped,
      results,
    });
  } catch (err) {
    console.error('[POST /api/compliance/calendar]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
