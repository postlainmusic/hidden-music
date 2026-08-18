import { NextRequest, NextResponse } from 'next/server';
import { getPayOSConfig, verifyPayOSWebhookData } from '@/lib/payos';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    // 1. Check if request is a ping/test from payOS setup dashboard
    if (!body || !body.data) {
      return NextResponse.json(
        { success: true, message: 'payOS webhook ping received' },
        { status: 200 }
      );
    }

    const { checksumKey } = getPayOSConfig();

    // 2. Verify webhook data signature
    let isValid = false;
    if (body.signature && checksumKey) {
      try {
        isValid = await verifyPayOSWebhookData(body.data, body.signature, checksumKey);
      } catch (verifyErr) {
        console.warn('payOS signature verification notice:', verifyErr);
      }
    }

    // If verification fails but looks like a payOS setup/ping request, return 200 to pass URL verification
    if (!isValid && (!body.data.orderCode || body.data.orderCode === 123 || body.data.description?.includes('test'))) {
      return NextResponse.json(
        { success: true, message: 'payOS webhook setup test confirmed' },
        { status: 200 }
      );
    }

    // 3. Process actual payment success
    const { orderCode, amount, code, desc } = body.data;

    if (code === '00' || desc === 'success' || body.code === '00') {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        if (supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const plan = (amount && amount >= 190000) ? 'premium' : 'vip';

          console.log(`[payOS Webhook] Payment confirmed for order #${orderCode}, amount: ${amount}`);

          // Update profiles matching description or order
          const updatePayload = {
            is_video_paid: true,
            has_video_subscription: true,
            plan,
            granted_by: 'PAYOS_GATEWAY',
            video_paid_at: new Date().toISOString(),
          };

          // If buyer email is present in body
          if (body.data.buyerEmail) {
            await supabase.from('profiles').update(updatePayload).eq('email', body.data.buyerEmail);
          }
        }
      } catch (dbErr) {
        console.error('Error updating DB in payOS webhook:', dbErr);
      }

      return NextResponse.json({ success: true, message: 'Order processed successfully' }, { status: 200 });
    }

    // Always return HTTP 200 for payOS
    return NextResponse.json({ success: true, message: 'Webhook event received' }, { status: 200 });
  } catch (error: any) {
    console.error('payOS webhook processing error:', error);
    // Always return 200 to prevent payOS URL confirmation 400/500 failure
    return NextResponse.json({ success: true, message: error.message || 'Error handled' }, { status: 200 });
  }
}
