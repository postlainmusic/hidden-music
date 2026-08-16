export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2, getPresignedPutUrl } from '@/lib/r2';

export const runtime = 'nodejs';

/**
 * Handle Presigned PUT URL generation (GET or POST JSON)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName') || `file_${Date.now()}.bin`;
    const folder = searchParams.get('folder') || 'audio';

    const ext = fileName.split('.').pop() || 'bin';
    const rawBase = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueKey = `${folder}/${Date.now()}_${rawBase}.${ext}`;

    const { presignedUrl, publicUrl, key } = getPresignedPutUrl(uniqueKey, 3600);

    return NextResponse.json({
      success: true,
      presignedUrl,
      publicUrl,
      key,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('R2 Presigned URL GET error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // If client is requesting a Presigned PUT URL via JSON
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const fileName = body.fileName || `file_${Date.now()}.bin`;
      const folder = body.folder || 'audio';

      const ext = fileName.split('.').pop() || 'bin';
      const rawBase = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const uniqueKey = `${folder}/${Date.now()}_${rawBase}.${ext}`;

      const { presignedUrl, publicUrl, key } = getPresignedPutUrl(uniqueKey, 3600);

      return NextResponse.json({
        success: true,
        presignedUrl,
        publicUrl,
        key,
      });
    }

    // Fallback: Multipart FormData upload through server
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sanitize filename
    const ext = file.name.split('.').pop() || 'bin';
    const rawBase = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueKey = `${folder}/${Date.now()}_${rawBase}.${ext}`;

    const fileContentType = file.type || 'application/octet-stream';
    const publicUrl = await uploadToR2(uniqueKey, buffer, fileContentType);

    return NextResponse.json({
      success: true,
      key: uniqueKey,
      url: publicUrl,
      fileName: file.name,
      size: file.size,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('R2 upload route error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
