import { NextRequest, NextResponse } from 'next/server';
import { getPayOSPaymentInfo } from '@/lib/payos';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderCode = searchParams.get('orderCode');
    const userEmail = searchParams.get('email');
    const userId = searchParams.get('userId');

    if (!orderCode) {
      return NextResponse.json({ success: false, error: 'Thiếu tham số orderCode' }, { status: 400 });
    }

    const paymentInfo = await getPayOSPaymentInfo(orderCode);
    const isPaid = paymentInfo.status === 'PAID';

    // If paid and user information is provided, sync to Supabase profiles
    if (isPaid && (userId || userEmail)) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        if (supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const plan = paymentInfo.amount >= 190000 ? 'premium' : 'vip';

          const updatePayload = {
            plan,
            has_video_subscription: true,
            is_video_paid: true,
            video_paid_at: new Date().toISOString(),
            granted_by: 'PAYOS_GATEWAY',
          };

          if (userId && userId.length > 20) {
            await supabase.from('profiles').update(updatePayload).eq('id', userId);
          } else if (userEmail) {
            await supabase.from('profiles').update(updatePayload).eq('email', userEmail);
          }
        }
      } catch (dbErr) {
        console.warn('Could not sync user profile to Supabase on payment check:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      paid: isPaid,
      status: paymentInfo.status,
      amount: paymentInfo.amount,
      orderCode: paymentInfo.orderCode,
      data: paymentInfo,
    });
  } catch (error: any) {
    console.error('Error checking payOS payment status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Không thể kiểm tra trạng thái thanh toán',
      },
      { status: 500 }
    );
  }
}
