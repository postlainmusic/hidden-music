import { NextRequest, NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/r2';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
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

    const contentType = file.type || 'application/octet-stream';
    const publicUrl = await uploadToR2(uniqueKey, buffer, contentType);

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
