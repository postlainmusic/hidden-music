import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BUILT_IN_FALLBACK_CODES = [
  'VIP',
  'VIP2026',
  'LUCIIPASS',
  'LUCIINGO1108',
  'VAULT2026',
  'PREMIUM',
  'TESTPASS',
  'HIDDENMUSIC',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, userId, email } = body;

    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập mã Voucher / Passcode.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let resolvedPlanType: 'monthly' | 'lifetime' = 'lifetime';
    let matchedVoucher: any = null;

    // 1. Try querying Database `vouchers` table
    try {
      const { data: voucher, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (voucher) {
        matchedVoucher = voucher;

        // Check if disabled
        if (voucher.is_active === false) {
          return NextResponse.json({
            success: false,
            error: `Mã "${cleanCode}" hiện đang bị tạm khóa hoặc đã vô hiệu hóa.`,
          }, { status: 400 });
        }

        // Check expiration
        if (voucher.expires_at) {
          const expireTime = new Date(voucher.expires_at).getTime();
          if (!isNaN(expireTime) && expireTime < Date.now()) {
            return NextResponse.json({
              success: false,
              error: `Mã "${cleanCode}" đã hết hạn sử dụng (${new Date(voucher.expires_at).toLocaleDateString('vi-VN')}).`,
            }, { status: 400 });
          }
        }

        // Check max uses limit (0 or null = unlimited)
        const maxUses = Number(voucher.max_uses) || 0;
        const usedCount = Number(voucher.used_count) || 0;
        if (maxUses > 0 && usedCount >= maxUses) {
          return NextResponse.json({
            success: false,
            error: `Mã "${cleanCode}" đã đạt giới hạn lượt sử dụng tối đa (${usedCount}/${maxUses}).`,
          }, { status: 400 });
        }

        resolvedPlanType = voucher.plan_type === 'monthly' ? 'monthly' : 'lifetime';

        // Increment used_count
        const newUsedCount = usedCount + 1;
        const shouldDisable = maxUses > 0 && newUsedCount >= maxUses;

        await supabase
          .from('vouchers')
          .update({
            used_count: newUsedCount,
            is_active: shouldDisable ? false : voucher.is_active,
          })
          .eq('id', voucher.id);
      }
    } catch (dbErr) {
      console.warn('Voucher DB lookup note:', dbErr);
    }

    // 2. If not found in DB, check Built-in Fallback Codes
    if (!matchedVoucher) {
      const isFallbackValid =
        BUILT_IN_FALLBACK_CODES.includes(cleanCode) ||
        cleanCode.startsWith('VAULT-VIP') ||
        cleanCode.startsWith('VAULT-PASS');

      if (isFallbackValid) {
        resolvedPlanType = cleanCode.includes('MONTH') ? 'monthly' : 'lifetime';
      } else {
        return NextResponse.json({
          success: false,
          error: 'Mã Voucher / Passcode không tồn tại hoặc đã hết hiệu lực.',
        }, { status: 400 });
      }
    }

    // 3. Update User Profile in Supabase (if user identified)
    const userRolePlan = resolvedPlanType === 'monthly' ? 'vip' : 'premium';
    const planNameVi = resolvedPlanType === 'monthly' ? 'Gói Tháng (VIP Monthly)' : 'Trọn Đời (Lifetime VIP)';

    if (userId || email) {
      try {
        let profileQuery = supabase.from('profiles').select('id, email');
        if (userId && userId.length > 20) {
          profileQuery = profileQuery.eq('id', userId);
        } else if (email) {
          profileQuery = profileQuery.eq('email', email);
        }

        const { data: existingUser } = await profileQuery.maybeSingle();
        if (existingUser) {
          await supabase
            .from('profiles')
            .update({
              is_video_paid: true,
              has_video_subscription: true,
              plan: userRolePlan,
              granted_by: `VOUCHER:${cleanCode}`,
              admin_note: `Kích hoạt qua mã Voucher ${cleanCode} (${resolvedPlanType}) lúc ${new Date().toLocaleString('vi-VN')}`,
              video_paid_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);
        }
      } catch (profileErr) {
        console.warn('Profile upgrade note:', profileErr);
      }
    }

    return NextResponse.json({
      success: true,
      code: cleanCode,
      planType: resolvedPlanType,
      plan: userRolePlan,
      message: `🎉 Kích hoạt thành công quyền truy cập Video Zone (${planNameVi})!`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Voucher redeem error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
