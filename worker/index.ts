/**
 * Cloudflare Worker Gateway & Hono API for Hidden Music Vault
 * -----------------------------------------------------------
 * Architecture & Endpoints:
 * 1. GET  /api/stream/:key+ -> RFC 7233 Range Request (HTTP 206 Partial Content) straight from R2 Bucket.
 * 2. POST /api/upload/presign -> AWS S3 SigV4 Presigned PUT URL for Client-to-R2 direct upload (no 4.5MB limits).
 * 3. GET  /api/tracks -> Supabase Edge Cached tracks list with stale-while-revalidate.
 * 4. GET  /api/tracks/:id -> Supabase track details by UUID.
 * 5. GET  /api/albums -> Supabase published albums with joined tracks.
 * 6. POST /api/sign-stream -> HMAC-SHA256 Expiring Stream Token Generator for private/secure tracks.
 * 7. GET  /health, /ping -> Edge Health & R2 Binding status.
 * 8. GET  /* -> Fallback R2 static asset delivery (covers, media, etc.).
 */

// Ambient Cloudflare Worker & R2 Types
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
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
}

const DEFAULT_SECRET = 'vault-stream-secret-key-prod-2026';
const DEFAULT_MAX_AGE_IMMUTABLE = 31536000; // 1 year for audio/video media
const DEFAULT_MAX_AGE_COVERS = 604800;      // 7 days for cover images

// Helper: Standard CORS Headers
function getCorsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get('Origin') || '*';
  const allowed = env.ALLOWED_ORIGINS || '*';
  const allowOrigin = allowed === '*' ? '*' : (allowed.split(',').map(s => s.trim()).includes(origin) ? origin : allowed.split(',')[0]);

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, PUT, POST, OPTIONS, DELETE');
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization, X-Requested-With, If-None-Match, If-Modified-Since, apikey');
  headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, ETag, Cache-Control, X-Vault-Cache, X-Vault-Secure, X-Vault-Stream');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
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

// Helper: HMAC-SHA256 verification
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
      return false;
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

// Helper: HMAC-SHA256 generation
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

// Helper: Generate AWS S3 SigV4 Presigned PUT URL using Web Crypto API
async function generateS3PresignedPutUrl(
  key: string,
  env: Env,
  expiresInSeconds: number = 3600
): Promise<{ presignedUrl: string; publicUrl: string; key: string }> {
  const cleanKey = key.replace(/^\/+/, '');
  const accountId = env.R2_ACCOUNT_ID || '5da953b3d1c0e1c733cf2285f8e7ab39';
  const accessKey = env.R2_ACCESS_KEY_ID || '57456fede976516aa1adecf2cd2b24e3';
  const secretKey = env.R2_SECRET_ACCESS_KEY || '4cb6fa310e4a74e524dd8217bb0bae7072b5f0fdd21c350d8591a65f29fd4ee4';
  const bucketName = env.R2_BUCKET_NAME || 'hidden-music-vault';
  const publicBase = (env.PUBLIC_URL || 'https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev').replace(/\/$/, '');

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credentialParam = `${accessKey}/${credentialScope}`;
  const signedHeaders = 'host';

  const queryParams = [
    `X-Amz-Algorithm=${encodeURIComponent(algorithm)}`,
    `X-Amz-Credential=${encodeURIComponent(credentialParam)}`,
    `X-Amz-Date=${encodeURIComponent(amzDate)}`,
    `X-Amz-Expires=${expiresInSeconds}`,
    `X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}`,
  ].sort().join('&');

  const canonicalUri = `/${bucketName}/${encodeURI(cleanKey).replace(/\+/g, '%20')}`;
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = `PUT\n${canonicalUri}\n${queryParams}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const enc = new TextEncoder();
  const canonHashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(canonicalRequest));
  const canonHash = Array.from(new Uint8Array(canonHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonHash}`;

  async function hmacSha256(keyBuf: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const k = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return await crypto.subtle.sign('HMAC', k, enc.encode(data));
  }

  const kDate = await hmacSha256(enc.encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signatureBuf = await hmacSha256(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const presignedUrl = `https://${host}${canonicalUri}?${queryParams}&X-Amz-Signature=${signature}`;
  const publicUrl = `${publicBase}/${cleanKey}`;

  return { presignedUrl, publicUrl, key: cleanKey };
}

// Main R2 Range Streaming Handler
async function handleR2Stream(rawKey: string, request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);
  const url = new URL(request.url);

  if (!rawKey) {
    return new Response(
      JSON.stringify({ error: 'Missing object key' }),
      { status: 400, headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' } }
    );
  }

  const secretKey = env.STREAM_SECRET_KEY || DEFAULT_SECRET;
  const token = url.searchParams.get('token');
  const expires = url.searchParams.get('expires');
  const isSecureRequired = url.searchParams.get('secure') === '1' || rawKey.startsWith('private/');

  if (isSecureRequired || token) {
    if (!token || !expires) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Streaming token is required', code: 'TOKEN_REQUIRED' }),
        { status: 403, headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' } }
      );
    }

    const isValid = await verifyHmacToken(rawKey, token, expires, secretKey);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Invalid or expired streaming token', code: 'TOKEN_EXPIRED' }),
        { status: 403, headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' } }
      );
    }
  }

  const ifNoneMatch = request.headers.get('If-None-Match');
  const rangeHeader = request.headers.get('Range');
  const isCover = rawKey.startsWith('covers/') || rawKey.endsWith('.jpg') || rawKey.endsWith('.png') || rawKey.endsWith('.webp');

  try {
    if (rangeHeader) {
      const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (matches) {
        const startStr = matches[1];
        const endStr = matches[2];

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

        const r2Object = await env.BUCKET.get(rawKey, {
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

    const r2Object = await env.BUCKET.get(rawKey, {
      onlyIf: ifNoneMatch ? { etagDoesNotMatch: ifNoneMatch } : undefined,
    });

    if (!r2Object) {
      return new Response('File Not Found in Vault', { status: 404, headers: corsHeaders });
    }

    if (!('body' in r2Object)) {
      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set('ETag', r2Object.httpEtag);
      responseHeaders.set('Cache-Control', `public, max-age=${isCover ? DEFAULT_MAX_AGE_COVERS : DEFAULT_MAX_AGE_IMMUTABLE}`);
      return new Response(null, { status: 304, headers: responseHeaders });
    }

    const responseHeaders = new Headers(corsHeaders);
    const contentType = r2Object.httpMetadata?.contentType || getContentType(rawKey);
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Content-Length', r2Object.size.toString());
    responseHeaders.set('ETag', r2Object.httpEtag);
    responseHeaders.set(
      'Cache-Control',
      isCover
        ? `public, max-age=${DEFAULT_MAX_AGE_COVERS}, stale-while-revalidate=86400`
        : `public, max-age=${DEFAULT_MAX_AGE_IMMUTABLE}, immutable`
    );

    if (token) responseHeaders.set('X-Vault-Secure', 'verified');

    return new Response((r2Object as R2ObjectBody).body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Vault Stream Gateway Error: ${message}` }), {
      status: 500,
      headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === '/health' || url.pathname === '/ping') {
      return new Response(
        JSON.stringify({
          status: 'online',
          service: 'Hidden Music Vault - Hono Cloudflare Worker API & Gateway',
          version: '3.0.0',
          timestamp: new Date().toISOString(),
          r2_connected: !!env.BUCKET,
          supabase_configured: !!env.SUPABASE_URL,
        }),
        {
          status: 200,
          headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
        }
      );
    }

    if (url.pathname === '/api/upload/presign' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { key?: string; filename?: string; expiresInSeconds?: number };
        const rawKey = body.key || body.filename;
        if (!rawKey) {
          return new Response(
            JSON.stringify({ error: 'Missing key or filename in request body' }),
            { status: 400, headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' } }
          );
        }

        const result = await generateS3PresignedPutUrl(rawKey, env, body.expiresInSeconds || 3600);
        return new Response(JSON.stringify({ success: true, ...result }), {
          status: 200,
          headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/api/sign-stream' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { key: string; expiresInSeconds?: number };
        if (!body.key) {
          return new Response(
            JSON.stringify({ error: 'Missing key parameter' }),
            { status: 400, headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' } }
          );
        }

        const cleanKey = body.key.replace(/^\/+/, '');
        const secret = env.STREAM_SECRET_KEY || DEFAULT_SECRET;
        const expiresIn = body.expiresInSeconds || 7200;
        const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
        const token = await generateHmacToken(cleanKey, expiresAt, secret);
        const gatewayUrl = `${url.origin}/api/stream/${cleanKey}?token=${token}&expires=${expiresAt}`;

        return new Response(
          JSON.stringify({ success: true, key: cleanKey, token, expiresAt, gatewayUrl }),
          { status: 200, headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' } }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/api/albums' && request.method === 'GET') {
      const supabaseUrl = env.SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
      const supabaseKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZW13ZnF5bmZsanBtdnhtcGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTIwMDYsImV4cCI6MjEwMjIyODAwNn0.btnyUiVm-KqKlGQ-PlhVdPBy-VP005ltDMzABIHfYro';

      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/albums?select=*,tracks(*)&is_published=eq.true&order=created_at.desc`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        });
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: {
            ...Object.fromEntries(corsHeaders),
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname.startsWith('/api/tracks') && request.method === 'GET') {
      const supabaseUrl = env.SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
      const supabaseKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZW13ZnF5bmZsanBtdnhtcGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTIwMDYsImV4cCI6MjEwMjIyODAwNn0.btnyUiVm-KqKlGQ-PlhVdPBy-VP005ltDMzABIHfYro';

      const trackId = url.pathname.replace('/api/tracks', '').replace(/^\/+/, '');
      const endpoint = trackId
        ? `${supabaseUrl}/rest/v1/tracks?id=eq.${trackId}&select=*`
        : `${supabaseUrl}/rest/v1/tracks?select=*&order=track_number.asc`;

      try {
        const res = await fetch(endpoint, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        });
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: {
            ...Object.fromEntries(corsHeaders),
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname.startsWith('/api/stream/')) {
      const rawKey = decodeURIComponent(url.pathname.replace('/api/stream/', '').replace(/^\/+/, ''));
      return await handleR2Stream(rawKey, request, env);
    }

    const fallbackKey = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (fallbackKey) {
      return await handleR2Stream(fallbackKey, request, env);
    }

    return new Response(
      JSON.stringify({
        name: 'Hidden Music Vault API Gateway',
        status: 'online',
        endpoints: ['/api/stream/:key', '/api/upload/presign', '/api/tracks', '/api/albums', '/health'],
      }),
      { status: 200, headers: { ...Object.fromEntries(corsHeaders), 'Content-Type': 'application/json' } }
    );
  },
};
