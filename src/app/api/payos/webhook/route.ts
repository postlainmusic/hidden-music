import { NextRequest, NextResponse } from 'next/server';
import { getPayOSConfig, verifyPayOSWebhookData } from '@/lib/payos';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checksumKey } = getPayOSConfig();

    if (!body || !body.data || !body.signature) {
      return NextResponse.json({ success: false, message: 'Dữ liệu webhook không hợp lệ' }, { status: 400 });
    }

    // Verify webhook signature
    const isValid = verifyPayOSWebhookData(body.data, body.signature, checksumKey);
    if (!isValid) {
      console.warn('Invalid payOS webhook signature received');
      return NextResponse.json({ success: false, message: 'Chữ ký webhook không hợp lệ' }, { status: 400 });
    }

    const { orderCode, amount, code, desc } = body.data;

    // Code "00" indicates successful transaction
    if (code === '00' || desc === 'success') {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const plan = amount >= 190000 ? 'premium' : 'vip';

        // Log payment record in feedback/payments or update user if metadata matches
        console.log(`[payOS Webhook] Payment received successfully! Order #${orderCode}, Amount: ${amount} VND`);
      } catch (dbErr) {
        console.error('Error handling webhook DB update:', dbErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    console.error('payOS webhook processing error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
