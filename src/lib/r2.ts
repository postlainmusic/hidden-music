const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '5da953b3d1c0e1c733cf2285f8e7ab39';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '57456fede976516aa1adecf2cd2b24e3';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '4cb6fa310e4a74e524dd8217bb0bae7072b5f0fdd21c350d8591a65f29fd4ee4';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'hidden-music-vault';
const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev').replace(/\/$/, '');

export * from './r2Storage';

// Universal Web Crypto Helpers
async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Raw(key: string | Uint8Array | ArrayBuffer, data: string | Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const rawKey = typeof key === 'string' ? enc.encode(key) : key;
  const rawData = typeof data === 'string' ? enc.encode(data) : data;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, rawData);
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
 * Generate an AWS S3 Signature V4 Presigned PUT URL for direct client-to-R2 upload.
 * Compatible with Edge Runtime and Browser.
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
