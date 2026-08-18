export interface PayOSPaymentItem {
  name: string;
  quantity: number;
  price: number;
}

export interface CreatePaymentLinkParams {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  items?: PayOSPaymentItem[];
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
}

export interface PayOSPaymentData {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'CANCELLED';
  checkoutUrl: string;
  qrCode: string;
}

export interface PayOSResponse<T> {
  code: string;
  desc: string;
  data: T;
  signature?: string;
}

const PAYOS_API_URL = 'https://api-merchant.payos.vn/v2/payment-requests';

export function getPayOSConfig() {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hiddenmusic.postlain.com';

  if (!clientId || !apiKey || !checksumKey) {
    console.warn('payOS environment variables are not fully configured.');
  }

  return {
    clientId: clientId || '',
    apiKey: apiKey || '',
    checksumKey: checksumKey || '',
    appUrl: appUrl.replace(/\/$/, ''),
  };
}

/**
 * Universal Web Crypto HMAC SHA-256 for Edge and Node.js Runtimes
 */
async function computeHmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate HMAC SHA256 Signature for PayOS payment link creation
 */
export async function generatePayOSSignature(data: {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number;
  returnUrl: string;
}, checksumKey: string): Promise<string> {
  const dataString = `amount=${data.amount}&cancelUrl=${data.cancelUrl}&description=${data.description}&orderCode=${data.orderCode}&returnUrl=${data.returnUrl}`;
  return computeHmacSha256(checksumKey, dataString);
}

/**
 * Verify PayOS Webhook signature
 */
export async function verifyPayOSWebhookData(data: Record<string, any>, signature: string, checksumKey: string): Promise<boolean> {
  try {
    const sortedKeys = Object.keys(data).sort();
    const signString = sortedKeys
      .map((key) => `${key}=${data[key] !== null && data[key] !== undefined ? data[key] : ''}`)
      .join('&');

    const expectedSignature = await computeHmacSha256(checksumKey, signString);
    return expectedSignature === signature;
  } catch (err) {
    console.error('Error verifying payOS webhook signature:', err);
    return false;
  }
}

/**
 * Create Payment Link via payOS REST API
 */
export async function createPayOSPaymentLink(params: CreatePaymentLinkParams): Promise<PayOSPaymentData> {
  const { clientId, apiKey, checksumKey } = getPayOSConfig();

  if (!clientId || !apiKey || !checksumKey) {
    throw new Error('Cấu hình payOS chưa hoàn tất. Vui lòng kiểm tra PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY.');
  }

  // Ensure description is clean and <= 25 chars (payOS constraint)
  const cleanDescription = params.description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 25);

  const signature = await generatePayOSSignature(
    {
      amount: params.amount,
      cancelUrl: params.cancelUrl,
      description: cleanDescription,
      orderCode: params.orderCode,
      returnUrl: params.returnUrl,
    },
    checksumKey
  );

  const payload = {
    orderCode: params.orderCode,
    amount: params.amount,
    description: cleanDescription,
    returnUrl: params.returnUrl,
    cancelUrl: params.cancelUrl,
    signature,
    items: params.items || [
      {
        name: 'Gói Video VIP Pass',
        quantity: 1,
        price: params.amount,
      },
    ],
    buyerName: params.buyerName,
    buyerEmail: params.buyerEmail,
    buyerPhone: params.buyerPhone,
  };

  const response = await fetch(PAYOS_API_URL, {
    method: 'POST',
    headers: {
      'x-client-id': clientId,
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json: PayOSResponse<PayOSPaymentData> = await response.json();

  if (json.code !== '00' && json.code !== '0') {
    throw new Error(`Lỗi payOS (${json.code}): ${json.desc || 'Không thể tạo link thanh toán'}`);
  }

  return json.data;
}

/**
 * Retrieve Payment Information for an Order Code
 */
export async function getPayOSPaymentInfo(orderCode: number | string): Promise<PayOSPaymentData> {
  const { clientId, apiKey } = getPayOSConfig();

  if (!clientId || !apiKey) {
    throw new Error('Cấu hình payOS chưa hoàn tất.');
  }

  const response = await fetch(`${PAYOS_API_URL}/${orderCode}`, {
    method: 'GET',
    headers: {
      'x-client-id': clientId,
      'x-api-key': apiKey,
    },
    cache: 'no-store',
  });

  const json: PayOSResponse<PayOSPaymentData> = await response.json();

  if (json.code !== '00' && json.code !== '0') {
    throw new Error(`Lỗi payOS (${json.code}): ${json.desc || 'Không tìm thấy thông tin đơn hàng'}`);
  }

  return json.data;
}
