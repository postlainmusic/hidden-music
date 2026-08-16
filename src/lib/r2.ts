import crypto from 'crypto';

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '5da953b3d1c0e1c733cf2285f8e7ab39';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '57456fede976516aa1adecf2cd2b24e3';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '4cb6fa310e4a74e524dd8217bb0bae7072b5f0fdd21c350d8591a65f29fd4ee4';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'hidden-music-vault';
const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev').replace(/\/$/, '');

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
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
