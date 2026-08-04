export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { authorizeRequest } from '@/lib/auth/session';
import { PermissionCodes } from '@/lib/auth/permission-codes';
const MAX_UPLOAD_MB = Number(
  process.env.MAX_DOCUMENT_UPLOAD_MB ?? 50
);

const MAX_UPLOAD_BYTES =
  MAX_UPLOAD_MB * 1024 * 1024;

// Allowlist, not a blocklist — safer by construction. Matches the document
// types actually in use in this vault (policies, reports, spreadsheets,
// evidence images/video). Deliberately excludes SVG (can embed executable
// <script>) and macro-enabled Office formats (.docm/.xlsm/.pptm etc, which
// can run code when opened by whoever downloads it later).
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'csv', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov',
]);

// Defense in depth against a file mislabeled with an allowed extension —
// checked against the browser-reported MIME type in addition to the
// extension allowlist above.
const BLOCKED_MIME_TYPES = new Set([
  'image/svg+xml',
  'text/html',
  'application/x-msdownload',
  'application/x-sh',
  'application/javascript',
  'text/javascript',
]);

// POST /api/documents/upload
// Accepts multipart/form-data with a 'file' field.
// Saves to public/uploads/docs/ and returns the public URL.
export async function POST(req: NextRequest) {
  try {
    const denied = await authorizeRequest(PermissionCodes.DOCUMENT_UPLOAD);
    if (denied) return denied;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Reject files larger than the configured upload limit.
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File exceeds the maximum upload size of ${MAX_UPLOAD_MB} MB.`,
        },
        { status: 413 }
      );
    }

    const ext = path.extname(file.name).slice(1).toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type ".${ext || 'unknown'}" is not allowed.` },
        { status: 400 }
      );
    }
    if (file.type && BLOCKED_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'File content type is not allowed.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitise filename and make unique
    const base = path.basename(file.name, path.extname(file.name)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const filename = `${Date.now()}-${base}.${ext}`;

    // Ensure directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'docs');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = `/uploads/docs/${filename}`;
    return NextResponse.json(
      {
        url,
        name: file.name,
        filename, // Stored filename on disk for future permanent delete
        size: file.size,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[UPLOAD]", err);

    const message =
      err instanceof Error ? err.message : String(err);

    if (
      message.includes("Failed to parse body as FormData") ||
      message.includes("Request body exceeded")
    ) {
      return NextResponse.json(
        {
          error: `File exceeds the maximum upload size of ${MAX_UPLOAD_MB} MB.`
        },
        {
          status: 413,
        }
      );
    }

    return NextResponse.json(
      {
        error: "Upload failed.",
      },
      { status: 500 }
    );
  }
}

