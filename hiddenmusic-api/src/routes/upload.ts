import { Hono } from 'hono';
import { Env } from '../types/env';

const uploadRoute = new Hono<{ Bindings: Env }>();

// POST /upload/presign (Generate S3 SigV4 direct upload URL or direct R2 upload)
uploadRoute.post('/presign', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const fileName = body?.fileName || `file_${Date.now()}`;
    const contentType = body?.contentType || 'audio/mpeg';
    const folder = body?.folder || 'audio';

    const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const objectKey = `${folder}/${Date.now()}_${safeName}`;
    const publicUrl = `${c.env.PUBLIC_R2_URL || 'https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev'}/${objectKey}`;

    return c.json({
      success: true,
      key: objectKey,
      publicUrl: publicUrl,
      streamUrl: `/stream/${objectKey}`,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default uploadRoute;
