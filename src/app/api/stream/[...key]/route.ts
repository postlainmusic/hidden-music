export const runtime = 'edge';

const R2_PUBLIC_BASE = 'https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev';

export async function GET(
  request: Request,
  { params }: { params: { key: string[] } }
) {
  try {
    const keyArray = params?.key || [];
    const cleanKey = keyArray.join('/');

    if (!cleanKey) {
      return new Response('Missing key', { status: 400 });
    }

    const targetUrl = `${R2_PUBLIC_BASE}/${cleanKey}`;
    const rangeHeader = request.headers.get('Range');

    const headers: Record<string, string> = {
      'User-Agent': 'Hidden-Music-Edge-Stream/1.0',
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    // Direct proxy to R2 with zero-buffering streaming
    const r2Response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, ETag, Cache-Control');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');

    // Pass through Content-Type, Content-Length, Content-Range, ETag
    const contentType = r2Response.headers.get('Content-Type') || (cleanKey.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream');
    responseHeaders.set('Content-Type', contentType);

    const contentLength = r2Response.headers.get('Content-Length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    const contentRange = r2Response.headers.get('Content-Range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    const etag = r2Response.headers.get('ETag');
    if (etag) responseHeaders.set('ETag', etag);

    return new Response(r2Response.body, {
      status: r2Response.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(`Stream Error: ${err?.message || 'Failed to stream'}`, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain',
      },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
