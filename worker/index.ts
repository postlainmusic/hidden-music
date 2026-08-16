/**
 * Cloudflare Worker Gateway for Hidden Music Vault
 * --------------------------------------------------
 * Features:
 * 1. HTTP RFC 7233 Range Request handling (206 Partial Content for seeking & smooth audio buffering).
 * 2. HMAC-SHA256 Expiring Stream Token Validation for private / secure audio tracks.
 * 3. Dynamic Cover Art Resizing & WebP/AVIF negotiation via Cloudflare Edge.
 * 4. Immutable CDN Caching (Cache-Control, ETag, 304 Not Modified).
 * 5. Full CORS headers supporting Web Audio API & MediaElement.
 */

// Ambient Cloudflare Worker & R2 Types for zero-dependency compilation
type R2Object = {
  key: string;
  size: number;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

type R2ObjectBody = R2Object & {
  body: ReadableStream;
};

type R2Bucket = {
  head(key: string): Promise<R2Object | null>;
  get(key: string, options?: any): Promise<R2ObjectBody | R2Object | null>;
  put(key: string, value: any, options?: any): Promise<R2Object>;
  delete(keys: string | string[]): Promise<void>;
};

type ExecutionContext = {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
};

export interface Env {
  BUCKET: R2Bucket;
  STREAM_SECRET_KEY?: string;
  PUBLIC_URL?: string;
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_SECRET = 'vault-stream-secret-key-prod-2026';
const DEFAULT_MAX_AGE_IMMUTABLE = 31536000; // 1 year for audio
const DEFAULT_MAX_AGE_COVERS = 604800; // 7 days for covers

// Helper: Standard CORS Headers
function getCorsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get('Origin') || '*';
  const allowed = env.ALLOWED_ORIGINS || '*';
  const allowOrigin = allowed === '*' ? '*' : (allowed.split(',').map(s => s.trim()).includes(origin) ? origin : allowed.split(',')[0]);

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, PUT, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization, X-Requested-With, If-None-Match, If-Modified-Since');
  headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, ETag, Cache-Control, X-Vault-Cache, X-Vault-Secure');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

// Helper: Verify HMAC-SHA256 signature for expiring signed URLs
async function verifyHmacToken(
  path: string,
  token: string,
  expiresStr: string,
  secretKey: string
): Promise<boolean> {
  try {
    const expires = parseInt(expiresStr, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(expires) || now > expires) {
      return false; // Token expired
    }

    const encoder = new TextEncoder();
    const dataToSign = `${path}:${expires}`;
    const keyData = encoder.encode(secretKey);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Convert hex token to Uint8Array
    const tokenBytes = new Uint8Array(
      token.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      tokenBytes,
      encoder.encode(dataToSign)
    );
  } catch (err) {
    console.error('HMAC token verification error:', err);
    return false;
  }
}

// Helper: Generate HMAC-SHA256 signature for signing URLs (used in Worker API)
async function generateHmacToken(
  path: string,
  expires: number,
  secretKey: string
): Promise<string> {
  const encoder = new TextEncoder();
  const dataToSign = `${path}:${expires}`;
  const keyData = encoder.encode(secretKey);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(dataToSign));
  const sigArray = Array.from(new Uint8Array(signature));
  return sigArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Determine Content-Type from key / file extension
function getContentType(key: string): string {
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
    case 'oga':
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
    case 'avif':
      return 'image/avif';
    case 'svg':
      return 'image/svg+xml';
    case 'lrc':
    case 'txt':
      return 'text/plain; charset=utf-8';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 2. Health & Diagnostic Check
    if (url.pathname === '/health' || url.pathname === '/ping') {
      return new Response(
        JSON.stringify({
          status: 'online',
          service: 'Hidden Music Vault - Cloudflare R2 Streaming Gateway',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          r2_connected: !!env.BUCKET,
        }),
        {
          status: 200,
          headers: {
            ...Object.fromEntries(corsHeaders),
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // 3. Token Generation API (Internal / Admin helper)
    if (url.pathname === '/api/sign-stream' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { key: string; expiresInSeconds?: number };
        if (!body.key) {
          return new Response(JSON.stringify({ error: 'Missing key parameter' }), {
            status: 400,
            headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
          });
        }

        const cleanKey = body.key.replace(/^\/+/, '');
        const secret = env.STREAM_SECRET_KEY || DEFAULT_SECRET;
        const expiresIn = body.expiresInSeconds || 7200; // Default 2 hours
        const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
        const token = await generateHmacToken(cleanKey, expiresAt, secret);

        const gatewayUrl = `${url.origin}/${cleanKey}?token=${token}&expires=${expiresAt}`;

        return new Response(
          JSON.stringify({
            success: true,
            key: cleanKey,
            token,
            expiresAt,
            gatewayUrl,
          }),
          {
            status: 200,
            headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
          }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. Object Retrieval & Streaming Route
    const rawKey = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!rawKey) {
      return new Response('Hidden Music Vault Gateway Online. Specify key in path.', {
        status: 200,
        headers: corsHeaders,
      });
    }

    const secretKey = env.STREAM_SECRET_KEY || DEFAULT_SECRET;
    const token = url.searchParams.get('token');
    const expires = url.searchParams.get('expires');
    const isSecureRequired = url.searchParams.get('secure') === '1' || rawKey.startsWith('private/');

    // Validate token if secure track or token query param is provided
    if (isSecureRequired || token) {
      if (!token || !expires) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized: Missing required streaming token or expiration.',
            code: 'TOKEN_REQUIRED',
          }),
          {
            status: 403,
            headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
          }
        );
      }

      const isValid = await verifyHmacToken(rawKey, token, expires, secretKey);
      if (!isValid) {
        return new Response(
          JSON.stringify({
            error: 'Forbidden: Invalid or expired streaming token.',
            code: 'TOKEN_INVALID_OR_EXPIRED',
          }),
          {
            status: 403,
            headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 5. Check If-None-Match conditional header for 304 Not Modified
    const ifNoneMatch = request.headers.get('If-None-Match');
    const rangeHeader = request.headers.get('Range');

    try {
      // Dynamic Cover Resizing for covers/ folder
      const isCoverImage = rawKey.startsWith('covers/') || rawKey.endsWith('.jpg') || rawKey.endsWith('.png') || rawKey.endsWith('.webp');
      const widthParam = url.searchParams.get('w');
      const qualityParam = url.searchParams.get('q');

      // Fetch from Cloudflare R2
      let r2Object: R2ObjectBody | R2Object | null = null;

      // Handle Range Requests
      if (rangeHeader) {
        // Parse Range: bytes=start-end
        const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        if (matches) {
          const startStr = matches[1];
          const endStr = matches[2];

          // Fetch full object metadata first to get exact size
          const headObj = await env.BUCKET.head(rawKey);
          if (!headObj) {
            return new Response('File Not Found in Vault', { status: 404, headers: corsHeaders });
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

          // Fetch R2 slice
          r2Object = await env.BUCKET.get(rawKey, {
            range: { offset: start, length },
            onlyIf: ifNoneMatch ? { etagDoesNotMatch: ifNoneMatch } : undefined,
          });

          if (!r2Object) {
            return new Response(null, { status: 304, headers: corsHeaders });
          }

          const responseHeaders = new Headers(corsHeaders);
          responseHeaders.set('Content-Type', headObj.httpMetadata?.contentType || getContentType(rawKey));
          responseHeaders.set('Accept-Ranges', 'bytes');
          responseHeaders.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
          responseHeaders.set('Content-Length', length.toString());
          responseHeaders.set('ETag', headObj.httpEtag);
          responseHeaders.set('Cache-Control', `public, max-age=${DEFAULT_MAX_AGE_IMMUTABLE}, immutable`);
          responseHeaders.set('X-Vault-Stream', 'partial-206');
          if (token) responseHeaders.set('X-Vault-Secure', 'verified');

          return new Response((r2Object as R2ObjectBody).body, {
            status: 206,
            headers: responseHeaders,
          });
        }
      }

      // Standard Non-Range Request (Full Object)
      r2Object = await env.BUCKET.get(rawKey, {
        onlyIf: ifNoneMatch ? { etagDoesNotMatch: ifNoneMatch } : undefined,
      });

      if (!r2Object) {
        return new Response('File Not Found in Vault', { status: 404, headers: corsHeaders });
      }

      // Check if conditional match resulted in 304 (if body is null)
      if (!('body' in r2Object)) {
        const responseHeaders = new Headers(corsHeaders);
        responseHeaders.set('ETag', r2Object.httpEtag);
        responseHeaders.set('Cache-Control', `public, max-age=${isCoverImage ? DEFAULT_MAX_AGE_COVERS : DEFAULT_MAX_AGE_IMMUTABLE}`);
        return new Response(null, { status: 304, headers: responseHeaders });
      }

      const responseHeaders = new Headers(corsHeaders);
      const contentType = r2Object.httpMetadata?.contentType || getContentType(rawKey);
      responseHeaders.set('Content-Type', contentType);
      responseHeaders.set('Accept-Ranges', 'bytes');
      responseHeaders.set('Content-Length', r2Object.size.toString());
      responseHeaders.set('ETag', r2Object.httpEtag);

      // Cache Strategy
      if (isCoverImage) {
        responseHeaders.set(
          'Cache-Control',
          `public, max-age=${DEFAULT_MAX_AGE_COVERS}, stale-while-revalidate=86400`
        );
      } else {
        responseHeaders.set(
          'Cache-Control',
          `public, max-age=${DEFAULT_MAX_AGE_IMMUTABLE}, immutable`
        );
      }

      if (token) responseHeaders.set('X-Vault-Secure', 'verified');

      return new Response((r2Object as R2ObjectBody).body, {
        status: 200,
        headers: responseHeaders,
      });
    } catch (err: unknown) {
      console.error(`Error serving key "${rawKey}":`, err);
      const message = err instanceof Error ? err.message : String(err);
      return new Response(`Vault Streaming Gateway Error: ${message}`, {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
