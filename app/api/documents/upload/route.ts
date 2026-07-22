export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
const MAX_UPLOAD_MB = Number(
  process.env.MAX_DOCUMENT_UPLOAD_MB ?? 50
);

const MAX_UPLOAD_BYTES =
  MAX_UPLOAD_MB * 1024 * 1024;

// POST /api/documents/upload
// Accepts multipart/form-data with a 'file' field.
// Saves to public/uploads/docs/ and returns the public URL.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    // DEBUG: Log incoming upload information.
    console.log('[UPLOAD] File:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
    });
    // Reject files larger than the configured upload limit.

    if (file && file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File exceeds the maximum upload size of ${MAX_UPLOAD_MB} MB.`,
        },
        { status: 413 }
      );
    }
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitise filename and make unique
    const ext = path.extname(file.name);
    const base = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const filename = `${Date.now()}-${base}${ext}`;

    // Ensure directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'docs');
    await mkdir(uploadDir, { recursive: true });
    // DEBUG: Confirm we're writing the file to disk.
    console.log('[UPLOAD] Writing file:', filename);
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = `/uploads/docs/${filename}`;
    // DEBUG: Upload completed successfully.
    console.log('[UPLOAD] Success:', filename);
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

    // DEBUG: Return the actual exception to help diagnose upload failures.
    return NextResponse.json(
      {
        error: "Upload failed.",
      },
      { status: 500 }
    );
  }
}

