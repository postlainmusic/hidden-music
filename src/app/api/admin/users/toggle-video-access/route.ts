import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { targetUserId, hasAccess, note, plan } = body;

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: 'Thiếu targetUserId' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseKey) {
      return NextResponse.json({ success: false, error: 'Thiếu cấu hình Supabase Key' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const updatePayload: Record<string, any> = {
      is_video_paid: Boolean(hasAccess),
      has_video_subscription: Boolean(hasAccess),
      plan: hasAccess ? (plan || 'vip') : 'free',
      video_paid_at: hasAccess ? new Date().toISOString() : null,
      granted_by: hasAccess ? 'ADMIN_MANUAL' : null,
      admin_note: note || null,
    };

    const { data: updatedUser, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', targetUserId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user video permission in Supabase:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: hasAccess
        ? `Đã cấp quyền Video VIP thành công cho người dùng ${updatedUser.email || updatedUser.display_name || targetUserId}`
        : `Đã thu hồi quyền Video VIP của người dùng ${updatedUser.email || updatedUser.display_name || targetUserId}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Toggle video access error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
