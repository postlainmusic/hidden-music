import { createClient } from '@/lib/supabase/client';
import { TrackItem } from '@/types/database';

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '5da953b3d1c0e1c733cf2285f8e7ab39';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '57456fede976516aa1adecf2cd2b24e3';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '4cb6fa310e4a74e524dd8217bb0bae7072b5f0fdd21c350d8591a65f29fd4ee4';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'hidden-music-vault';
const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || 'https://media.postlain.com').replace(/\/$/, '');

// Dedicated Production Media CDN Domain
export const MEDIA_CANONICAL_DOMAIN = 'https://media.postlain.com';

// Worker Gateway URL for Enhanced Range Requests & Streaming
const R2_WORKER_GATEWAY_URL = (process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || MEDIA_CANONICAL_DOMAIN).replace(/\/$/, '');
const STREAM_SECRET_KEY = process.env.STREAM_SECRET_KEY || 'vault-stream-secret-key-prod-2026';

// Universal Web Crypto Helpers
async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : (data as unknown as BufferSource);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer as BufferSource);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Raw(key: string | Uint8Array | ArrayBuffer, data: string | Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const rawKey = typeof key === 'string' ? enc.encode(key) : (key as unknown as BufferSource);
  const rawData = typeof data === 'string' ? enc.encode(data) : (data as unknown as BufferSource);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, rawData as BufferSource);
  return new Uint8Array(sigBuffer);
}

async function hmacSha256Hex(key: string | Uint8Array | ArrayBuffer, data: string | Uint8Array | ArrayBuffer): Promise<string> {
  const bytes = await hmacSha256Raw(key, data);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<Uint8Array> {
  const kDate = await hmacSha256Raw('AWS4' + key, dateStamp);
  const kRegion = await hmacSha256Raw(kDate, regionName);
  const kService = await hmacSha256Raw(kRegion, serviceName);
  const kSigning = await hmacSha256Raw(kService, 'aws4_request');
  return kSigning;
}

/**
 * Extract clean storage key from an absolute URL or path
 */
export function extractCleanKey(keyOrUrl: string): string {
  if (!keyOrUrl) return '';
  let clean = keyOrUrl.trim();
  // Remove public dev URL prefix or domain
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const parsed = new URL(clean);
      clean = parsed.pathname;
    } catch {}
  }
  return clean.replace(/^\/+/, '');
}

/**
 * Normalizes any media storage key or URL to the canonical https://media.postlain.com domain
 */
export function normalizeMediaUrl(urlOrKey: string): string {
  if (!urlOrKey) return '';
  const trimmed = urlOrKey.trim();

  // If already an external third-party stream not hosted on R2 (e.g. YouTube, external CDN)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (
      trimmed.includes('r2.dev') ||
      trimmed.includes('r2.cloudflarestorage.com') ||
      trimmed.includes('workers.dev') ||
      trimmed.includes('postlain.com')
    ) {
      try {
        const parsed = new URL(trimmed);
        const cleanPath = parsed.pathname.replace(/^\/+/, '');
        return `${MEDIA_CANONICAL_DOMAIN}/${cleanPath}`;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  const cleanKey = trimmed.replace(/^\/+/, '');
  return `${MEDIA_CANONICAL_DOMAIN}/${cleanKey}`;
}

/**
 * Generate an HMAC-SHA256 signed stream token for private / protected tracks
 */
export async function generateSignedStreamUrl(
  keyOrUrl: string,
  expiresInSeconds: number = 7200
): Promise<string> {
  const cleanKey = extractCleanKey(keyOrUrl);
  if (!cleanKey) return '';

  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const dataToSign = `${cleanKey}:${expiresAt}`;
  const token = await hmacSha256Hex(STREAM_SECRET_KEY, dataToSign);

  return `${MEDIA_CANONICAL_DOMAIN}/${cleanKey}?token=${token}&expires=${expiresAt}`;
}

/**
 * Get the CDN URL for audio/video streaming (Canonical domain https://media.postlain.com)
 */
export function getMediaCdnUrl(
  keyOrUrl: string,
  options?: { secure?: boolean; expiresInSeconds?: number }
): string {
  if (!keyOrUrl) return '';
  return normalizeMediaUrl(keyOrUrl);
}

/**
 * Get dynamic transformed Cover Art CDN URL (Canonical domain https://media.postlain.com)
 */
export function getCoverCdnUrl(
  keyOrUrl: string,
  options?: { width?: number; quality?: number; format?: 'webp' | 'avif' | 'jpeg' }
): string {
  if (!keyOrUrl) return '/icon.svg';
  const canonical = normalizeMediaUrl(keyOrUrl);
  if (!canonical || canonical === '/icon.svg') return '/icon.svg';

  const queryParts: string[] = [];
  if (options?.width) queryParts.push(`w=${options.width}`);
  if (options?.quality) queryParts.push(`q=${options.quality}`);
  if (options?.format) queryParts.push(`fmt=${options.format}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return `${canonical}${queryString}`;
}

/**
 * Generate AWS S3 SigV4 Presigned PUT URL for direct client-to-R2 upload (unlimited file sizes)
 */
export async function getPresignedPutUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<{ presignedUrl: string; publicUrl: string; key: string }> {
  const cleanKey = key.replace(/^\/+/, '');
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credentialParam = `${R2_ACCESS_KEY_ID}/${credentialScope}`;
  const signedHeaders = 'host';

  const queryParams = [
    `X-Amz-Algorithm=${encodeURIComponent(algorithm)}`,
    `X-Amz-Credential=${encodeURIComponent(credentialParam)}`,
    `X-Amz-Date=${encodeURIComponent(amzDate)}`,
    `X-Amz-Expires=${expiresInSeconds}`,
    `X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}`,
  ].sort().join('&');

  const canonicalUri = `/${R2_BUCKET_NAME}/${encodeURI(cleanKey).replace(/\+/g, '%20')}`;
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = `PUT\n${canonicalUri}\n${queryParams}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);

  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const signingKey = await getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  const presignedUrl = `https://${host}${canonicalUri}?${queryParams}&X-Amz-Signature=${signature}`;
  const publicUrl = `${R2_PUBLIC_URL}/${cleanKey}`;

  return { presignedUrl, publicUrl, key: cleanKey };
}

/**
 * Upload a binary buffer directly to Cloudflare R2 bucket using AWS S3 Signature V4
 */
export async function uploadToR2(
  key: string,
  buffer: ArrayBuffer | Uint8Array,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  const cleanKey = key.replace(/^\/+/, '');
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${R2_BUCKET_NAME}/${cleanKey}`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const payloadHash = await sha256Hex(buffer);

  const canonicalUri = `/${R2_BUCKET_NAME}/${encodeURI(cleanKey).replace(/\+/g, '%20')}`;
  const canonicalQuery = '';
  const canonicalHeaders =
    `content-type:${contentType.toLowerCase()}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    `PUT\n` +
    `${canonicalUri}\n` +
    `${canonicalQuery}\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalReqHash = await sha256Hex(canonicalRequest);
  const stringToSign =
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${canonicalReqHash}`;

  const signingKey = await getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  const authorizationHeader = `${algorithm} Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorizationHeader,
    },
    body: buffer as unknown as BodyInit,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('R2 PutObject error:', res.status, errText);
    throw new Error(`Cloudflare R2 Upload Failed (${res.status}): ${errText || res.statusText}`);
  }

  return `${R2_PUBLIC_URL}/${cleanKey}`;
}

/**
 * Delete an object from Cloudflare R2 bucket
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  const cleanKey = key.replace(/^\/+/, '');
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${R2_BUCKET_NAME}/${cleanKey}`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = await sha256Hex('');

  const canonicalUri = `/${R2_BUCKET_NAME}/${encodeURI(cleanKey).replace(/\+/g, '%20')}`;
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    `DELETE\n` +
    `${canonicalUri}\n\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalReqHash = await sha256Hex(canonicalRequest);
  const stringToSign =
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${canonicalReqHash}`;

  const signingKey = await getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  const authorizationHeader = `${algorithm} Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorizationHeader,
    },
  });

  return res.ok;
}

/**
 * Synchronize newly uploaded track metadata to database
 */
export async function syncTrackRecord(trackData: {
  album_id: string;
  title: string;
  artist?: string;
  audio_url: string;
  cover_url?: string;
  lyrics?: string;
  duration?: number;
  media_type?: 'audio' | 'video';
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = createClient();
    const payload = {
      album_id: trackData.album_id,
      title: trackData.title.trim(),
      artist: trackData.artist?.trim() || '',
      media_type: trackData.media_type || 'audio',
      audio_url: trackData.audio_url,
      video_url: '',
      cover_url: trackData.cover_url || '',
      lyrics: trackData.lyrics || '',
      duration: Math.round(trackData.duration || 0),
    };

    let { data, error } = await supabase.from('tracks').insert([payload]).select();

    if (error && (error.message?.includes('audio_url') || error.message?.includes('schema cache'))) {
      const fallbackPayload: Record<string, any> = { ...payload };
      fallbackPayload.url = fallbackPayload.audio_url;
      delete fallbackPayload.audio_url;
      const retry = await supabase.from('tracks').insert([fallbackPayload]).select();
      error = retry.error;
      data = retry.data;
    }

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data?.[0] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
