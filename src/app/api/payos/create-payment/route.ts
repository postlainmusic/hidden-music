import { NextRequest, NextResponse } from 'next/server';
import { createPayOSPaymentLink, getPayOSConfig } from '@/lib/payos';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { plan = 'monthly', userEmail, userName, userId } = body;

    const amount = plan === 'lifetime' ? 199000 : 49000;
    const planName = plan === 'lifetime' ? 'VIP TRON DOI' : 'VIP 1 THANG';

    // Generate unique 9-digit numeric order code
    const orderCode = Number(`${String(Date.now()).slice(-6)}${Math.floor(100 + Math.random() * 900)}`);
    const shortOrderSuffix = String(orderCode).slice(-4);
    const description = `VAULT ${plan === 'lifetime' ? 'LIFE' : '1M'} ${shortOrderSuffix}`;

    const { appUrl } = getPayOSConfig();
    const returnUrl = `${appUrl}/?payment=success&orderCode=${orderCode}&plan=${plan}`;
    const cancelUrl = `${appUrl}/?payment=cancelled`;

    const paymentData = await createPayOSPaymentLink({
      orderCode,
      amount,
      description,
      returnUrl,
      cancelUrl,
      items: [
        {
          name: `Hidden Music Vault - ${planName}`,
          quantity: 1,
          price: amount,
        },
      ],
      buyerName: userName || 'Vault Member',
      buyerEmail: userEmail || undefined,
    });

    return NextResponse.json({
      success: true,
      orderCode,
      amount,
      plan,
      description,
      checkoutUrl: paymentData.checkoutUrl,
      qrCode: paymentData.qrCode,
      accountNumber: paymentData.accountNumber,
      accountName: paymentData.accountName,
      bin: paymentData.bin,
      status: paymentData.status,
      paymentLinkId: paymentData.paymentLinkId,
    });
  } catch (error: any) {
    console.error('Error creating payOS payment link:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Không thể khởi tạo phiên thanh toán qua payOS',
      },
      { status: 500 }
    );
  }
}
