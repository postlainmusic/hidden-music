import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VoucherItem, VoucherPlanType } from '@/types/database';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
}

// GET: Lấy danh sách toàn bộ voucher
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: vouchers, error } = await supabase
      .from('vouchers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Vouchers table fetch notice:', error.message);
      // Fallback response if table has not been initialized in Supabase yet
      return NextResponse.json({
        success: true,
        vouchers: [],
        tableInitialized: false,
        note: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      vouchers: vouchers || [],
      tableInitialized: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Admin vouchers GET error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST: Tạo voucher mới, Bật/Tắt trạng thái, hoặc Xóa voucher
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'create', voucherId, code, plan_type, max_uses, expires_at, is_active } = body;

    const supabase = getSupabaseAdmin();

    // 1. ACTION: TOGGLE ACTIVE / INACTIVE
    if (action === 'toggle_active') {
      if (!voucherId) {
        return NextResponse.json({ success: false, error: 'Thiếu voucherId' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('vouchers')
        .update({ is_active: Boolean(is_active) })
        .eq('id', voucherId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({
        success: true,
        voucher: data,
        message: `Đã ${is_active ? 'kích hoạt' : 'vô hiệu hóa'} mã voucher thành công.`,
      });
    }

    // 2. ACTION: DELETE VOUCHER
    if (action === 'delete') {
      if (!voucherId) {
        return NextResponse.json({ success: false, error: 'Thiếu voucherId' }, { status: 400 });
      }

      const { error } = await supabase.from('vouchers').delete().eq('id', voucherId);
      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Đã xóa mã voucher thành công.',
      });
    }

    // 3. ACTION: CREATE NEW VOUCHER
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập mã Voucher / Passcode.' }, { status: 400 });
    }

    const payload = {
      code: cleanCode,
      plan_type: (plan_type === 'monthly' ? 'monthly' : 'lifetime') as VoucherPlanType,
      max_uses: Number(max_uses) >= 0 ? Number(max_uses) : 1,
      used_count: 0,
      expires_at: expires_at ? new Date(expires_at).toISOString() : null,
      is_active: true,
      created_by: 'ADMIN',
    };

    const { data: created, error: insertErr } = await supabase
      .from('vouchers')
      .insert([payload])
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key') || insertErr.message?.includes('unique')) {
        return NextResponse.json({ success: false, error: `Mã "${cleanCode}" đã tồn tại trên hệ thống. Vui lòng chọn mã khác.` }, { status: 400 });
      }
      throw insertErr;
    }

    return NextResponse.json({
      success: true,
      voucher: created,
      message: `Đã tạo mã voucher "${cleanCode}" thành công!`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Admin vouchers POST error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
