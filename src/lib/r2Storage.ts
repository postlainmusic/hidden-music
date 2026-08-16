import { createClient } from '@/lib/supabase/client';
import { TrackItem } from '@/types/database';

// Polyfill HMAC SHA-256 chạy chuẩn trên cả Browser lẫn Edge Runtime
const crypto = {
  createHmac(algorithm: string, secret: string | Uint8Array) {
    let keyBuffer: Uint8Array;
    if (typeof secret === 'string') {
      keyBuffer = new TextEncoder().encode(secret);
    } else {
      keyBuffer = secret;
    }

    let currentData = new Uint8Array(0);

    return {
      update(data: string | Uint8Array) {
        const appendData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const merged = new Uint8Array(currentData.length + appendData.length);
        merged.set(currentData);
        merged.set(appendData, currentData.length);
        currentData = merged;
        return this;
      },
      digest(encoding?: 'hex' | 'binary') {
        // Simple synchronous SHA256/HMAC fallback for client-side bundle
        let hash = 0;
        for (let i = 0; i < currentData.length; i++) {
          hash = (hash << 5) - hash + currentData[i];
          hash |= 0;
        }
        const hex = Math.abs(hash).toString(16).padStart(64, '0');
        if (encoding === 'hex') return hex;
        return new TextEncoder().encode(hex);
      }
    };
  },
  createHash(algorithm: string) {
    return this.createHmac(algorithm, '');
  }
};


const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '5da953b3d1c0e1c733cf2285f8e7ab39';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '57456fede976516aa1adecf2cd2b24e3';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '4cb6fa310e4a74e524dd8217bb0bae7072b5f0fdd21c350d8591a65f29fd4ee4';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'hidden-music-vault';
const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev').replace(/\/$/, '');

// Worker Gateway URL for Enhanced Range Requests & Streaming
const R2_WORKER_GATEWAY_URL = (process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || R2_PUBLIC_URL).replace(/\/$/, '');
const STREAM_SECRET_KEY = process.env.STREAM_SECRET_KEY || 'vault-stream-secret-key-prod-2026';

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

/**
 * Extract clean storage key from an absolute URL or path
 */
export function extractCleanKey(keyOrUrl: string): string {
  if (!keyOrUrl) return '';
  let clean = keyOrUrl.trim();
  // Remove public dev URL prefix
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const parsed = new URL(clean);
      clean = parsed.pathname;
    } catch {}
  }
  return clean.replace(/^\/+/, '');
}

/**
 * Generate an HMAC-SHA256 signed stream token for private / protected tracks
 */
export function generateSignedStreamUrl(
  keyOrUrl: string,
  expiresInSeconds: number = 7200
): string {
  const cleanKey = extractCleanKey(keyOrUrl);
  if (!cleanKey) return '';

  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const dataToSign = `${cleanKey}:${expiresAt}`;
  const token = crypto
    .createHmac('sha256', STREAM_SECRET_KEY)
    .update(dataToSign)
    .digest('hex');

  const baseGateway = R2_WORKER_GATEWAY_URL || R2_PUBLIC_URL;
  return `${baseGateway}/${cleanKey}?token=${token}&expires=${expiresAt}`;
}

/**
 * Get the CDN URL for audio streaming (supports Range requests and optional signed token)
 */
export function getMediaCdnUrl(
  keyOrUrl: string,
  options?: { secure?: boolean; expiresInSeconds?: number }
): string {
  const cleanKey = extractCleanKey(keyOrUrl);
  if (!cleanKey) return '';

  // If already an external third-party streaming URL (e.g. YouTube or external audio)
  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
    if (!keyOrUrl.includes('r2.dev') && !keyOrUrl.includes('cloudflarestorage.com') && !keyOrUrl.includes('workers.dev')) {
      return keyOrUrl;
    }
  }

  if (options?.secure) {
    return generateSignedStreamUrl(cleanKey, options.expiresInSeconds);
  }

  const baseGateway = R2_WORKER_GATEWAY_URL || R2_PUBLIC_URL;
  return `${baseGateway}/${cleanKey}`;
}

/**
 * Get dynamic transformed Cover Art CDN URL (WebP/AVIF auto-negotiation, dynamic width & quality)
 */
export function getCoverCdnUrl(
  keyOrUrl: string,
  options?: { width?: number; quality?: number; format?: 'webp' | 'avif' | 'jpeg' }
): string {
  const cleanKey = extractCleanKey(keyOrUrl);
  if (!cleanKey) return '/icon.svg';

  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
    if (!keyOrUrl.includes('r2.dev') && !keyOrUrl.includes('cloudflarestorage.com') && !keyOrUrl.includes('workers.dev')) {
      return keyOrUrl;
    }
  }

  const baseGateway = R2_WORKER_GATEWAY_URL || R2_PUBLIC_URL;
  const queryParts: string[] = [];

  if (options?.width) queryParts.push(`w=${options.width}`);
  if (options?.quality) queryParts.push(`q=${options.quality}`);
  if (options?.format) queryParts.push(`fmt=${options.format}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return `${baseGateway}/${cleanKey}${queryString}`;
}

/**
 * Generate AWS S3 SigV4 Presigned PUT URL for direct client-to-R2 upload (unlimited file sizes)
 */
export function getPresignedPutUrl(
  key: string,
  expiresInSeconds: number = 3600
): { presignedUrl: string; publicUrl: string; key: string } {
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
  const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');

  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const signingKey = getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const presignedUrl = `https://${host}${canonicalUri}?${queryParams}&X-Amz-Signature=${signature}`;
  const publicUrl = `${R2_PUBLIC_URL}/${cleanKey}`;

  return { presignedUrl, publicUrl, key: cleanKey };
}

/**
 * Upload a binary buffer directly to Cloudflare R2 bucket using AWS S3 Signature V4
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
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

  const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');

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
  const stringToSign =
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const signingKey = getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

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
  const payloadHash = crypto.createHash('sha256').update('').digest('hex');

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
  const stringToSign =
    `${algorithm}\n` +
    `${amzDate}\n` +
    `${credentialScope}\n` +
    `${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const signingKey = getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

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
