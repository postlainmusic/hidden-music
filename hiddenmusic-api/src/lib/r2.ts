import { Env } from '../types/env';

export function getContentType(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'flac':
      return 'audio/flac';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'lrc':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

export async function handleR2Stream(
  rawKey: string,
  request: Request,
  env: Env,
  corsHeaders: Headers
): Promise<Response> {
  const cleanKey = decodeURIComponent(rawKey).replace(/^\/+/, '');
  const ifNoneMatch = request.headers.get('If-None-Match');
  const rangeHeader = request.headers.get('Range');
  const isCover = cleanKey.startsWith('covers/') || cleanKey.endsWith('.jpg') || cleanKey.endsWith('.png') || cleanKey.endsWith('.webp');

  try {
    // 1. Handle HTTP 206 Range Requests (Zero buffering, instant playback)
    if (rangeHeader && env.MY_BUCKET) {
      const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (matches) {
        const startStr = matches[1];
        const endStr = matches[2];

        // Fetch head metadata
        const headObj = await env.MY_BUCKET.head(cleanKey);
        if (!headObj) {
          // If not in binding, try direct public R2 fallback
          return await proxyPublicR2(cleanKey, request, env, corsHeaders);
        }

        const totalSize = headObj.size;
        let start = startStr ? parseInt(startStr, 10) : 0;
        let end = endStr ? parseInt(endStr, 10) : totalSize - 1;

        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= totalSize) end = totalSize - 1;
        if (start > end) {
          const errorHeaders = new Headers(corsHeaders);
          errorHeaders.set('Content-Range', `bytes */${totalSize}`);
          return new Response('Requested Range Not Satisfiable', { status: 416, headers: errorHeaders });
        }

        const length = end - start + 1;
        const r2Object = await env.MY_BUCKET.get(cleanKey, {
          range: { offset: start, length },
          onlyIf: ifNoneMatch ? { etagDoesNotMatch: ifNoneMatch } : undefined,
        });

        if (!r2Object) {
          return new Response(null, { status: 304, headers: corsHeaders });
        }

        const responseHeaders = new Headers(corsHeaders);
        responseHeaders.set('Content-Type', headObj.httpMetadata?.contentType || getContentType(cleanKey));
        responseHeaders.set('Accept-Ranges', 'bytes');
        responseHeaders.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        responseHeaders.set('Content-Length', length.toString());
        responseHeaders.set('ETag', headObj.httpEtag);
        responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
        responseHeaders.set('X-Vault-Stream', 'partial-206');

        return new Response((r2Object as any).body, {
          status: 206,
          headers: responseHeaders,
        });
      }
    }

    // 2. Full Object Stream
    if (env.MY_BUCKET) {
      const r2Object = await env.MY_BUCKET.get(cleanKey, {
        onlyIf: ifNoneMatch ? { etagDoesNotMatch: ifNoneMatch } : undefined,
      });

      if (r2Object) {
        if (!('body' in r2Object)) {
          const responseHeaders = new Headers(corsHeaders);
          responseHeaders.set('ETag', (r2Object as any).httpEtag);
          responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
          return new Response(null, { status: 304, headers: responseHeaders });
        }

        const responseHeaders = new Headers(corsHeaders);
        const contentType = (r2Object as any).httpMetadata?.contentType || getContentType(cleanKey);
        responseHeaders.set('Content-Type', contentType);
        responseHeaders.set('Accept-Ranges', 'bytes');
        responseHeaders.set('Content-Length', (r2Object as any).size.toString());
        responseHeaders.set('ETag', (r2Object as any).httpEtag);
        responseHeaders.set(
          'Cache-Control',
          isCover
            ? 'public, max-age=604800, stale-while-revalidate=86400'
            : 'public, max-age=31536000, immutable'
        );

        return new Response((r2Object as any).body, {
          status: 200,
          headers: responseHeaders,
        });
      }
    }

    // 3. Fallback: Proxy to Public R2 Domain
    return await proxyPublicR2(cleanKey, request, env, corsHeaders);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
    });
  }
}

async function proxyPublicR2(
  cleanKey: string,
  request: Request,
  env: Env,
  corsHeaders: Headers
): Promise<Response> {
  const publicBase = env.PUBLIC_R2_URL || 'https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev';
  const targetUrl = `${publicBase}/${cleanKey}`;
  const rangeHeader = request.headers.get('Range');

  const headers: Record<string, string> = { 'User-Agent': 'HiddenMusic-Worker/1.0' };
  if (rangeHeader) headers['Range'] = rangeHeader;

  const r2Res = await fetch(targetUrl, { method: 'GET', headers });
  const responseHeaders = new Headers(corsHeaders);

  responseHeaders.set('Accept-Ranges', 'bytes');
  responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');

  const contentType = r2Res.headers.get('Content-Type') || getContentType(cleanKey);
  responseHeaders.set('Content-Type', contentType);

  const contentLength = r2Res.headers.get('Content-Length');
  if (contentLength) responseHeaders.set('Content-Length', contentLength);

  const contentRange = r2Res.headers.get('Content-Range');
  if (contentRange) responseHeaders.set('Content-Range', contentRange);

  return new Response(r2Res.body, {
    status: r2Res.status,
    headers: responseHeaders,
  });
}
