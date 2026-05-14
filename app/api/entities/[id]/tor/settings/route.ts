/**
 * GET  /api/entities/[id]/tor/settings  — load persisted ToR settings for entity
 * PUT  /api/entities/[id]/tor/settings  — save ToR settings for entity
 *
 * Uses raw SQL so this route works before `prisma generate` is re-run
 * after the torSettings column is added to the schema.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface StoredFile {
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  /** Base64-encoded content — only present for files ≤ 2 MB */
  contentBase64?: string;
  /** True when file was too large to store inline */
  largeFile?: boolean;
}

export interface TorSettings {
  quorum?: number;
  meetingFrequency?: string;
  noticePeriodDays?: number;
  chairCastingVote?: boolean;
  effectiveDate?: string;
  purpose?: string;
  /** All currently-selected reserved matters */
  selectedMatters?: string[];
  /** Extra matters added beyond template defaults */
  customMatters?: string[];
  constitutionFile?: StoredFile | null;
  shaFile?: StoredFile | null;
  lastSavedAt?: string;
}

const MAX_INLINE_BYTES = 2 * 1024 * 1024; // 2 MB

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const rows = await prisma.$queryRaw<Array<{ torSettings: unknown }>>`
      SELECT "torSettings" FROM "entities" WHERE id = ${id} LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    return NextResponse.json({
      settings: (rows[0].torSettings as TorSettings | null) ?? null,
      aiEnabled: !!process.env.ANTHROPIC_API_KEY,
    });
  } catch (err: unknown) {
    // Column doesn't exist yet — migration not yet run
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('torSettings') || msg.includes('column')) {
      return NextResponse.json({
        settings: null,
        aiEnabled: !!process.env.ANTHROPIC_API_KEY,
        migrationPending: true,
      });
    }
    console.error('[GET /tor/settings]', err);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const contentType = request.headers.get('content-type') ?? '';
  let settings: TorSettings;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const settingsRaw = formData.get('settings');
    if (!settingsRaw || typeof settingsRaw !== 'string') {
      return NextResponse.json({ error: 'Missing settings field' }, { status: 400 });
    }
    settings = JSON.parse(settingsRaw);

    // Process file uploads and store as base64 if within size limit
    const constitutionFile = formData.get('constitution') as File | null;
    const shaFile = formData.get('sha') as File | null;

    if (constitutionFile) {
      const buf = Buffer.from(await constitutionFile.arrayBuffer());
      const stored: StoredFile = {
        name: constitutionFile.name,
        size: buf.length,
        mimeType: constitutionFile.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      };
      if (buf.length <= MAX_INLINE_BYTES) {
        stored.contentBase64 = buf.toString('base64');
      } else {
        stored.largeFile = true;
      }
      settings.constitutionFile = stored;
    }

    if (shaFile) {
      const buf = Buffer.from(await shaFile.arrayBuffer());
      const stored: StoredFile = {
        name: shaFile.name,
        size: buf.length,
        mimeType: shaFile.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      };
      if (buf.length <= MAX_INLINE_BYTES) {
        stored.contentBase64 = buf.toString('base64');
      } else {
        stored.largeFile = true;
      }
      settings.shaFile = stored;
    }
  } else {
    settings = await request.json();
  }

  settings.lastSavedAt = new Date().toISOString();

  try {
    await prisma.$executeRaw`
      UPDATE "entities"
      SET "torSettings" = ${JSON.stringify(settings)}::jsonb,
          "updatedAt"   = NOW()
      WHERE id = ${id}
    `;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('torSettings') || msg.includes('column')) {
      return NextResponse.json({
        error: 'Database migration required. Please run: npx prisma migrate dev --name add_tor_settings',
        code: 'MIGRATION_PENDING',
      }, { status: 503 });
    }
    console.error('[PUT /tor/settings]', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  return NextResponse.json({ settings, ok: true });
}
