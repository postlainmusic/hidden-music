import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';
    const filter = searchParams.get('filter') || 'all';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseKey) {
      return NextResponse.json({ success: false, error: 'Thiếu cấu hình Supabase Key' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let queryBuilder = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply text search
    if (query) {
      queryBuilder = queryBuilder.or(`email.ilike.%${query}%,display_name.ilike.%${query}%,id.ilike.%${query}%`);
    }

    // Apply VIP filter
    if (filter === 'vip') {
      queryBuilder = queryBuilder.or('is_video_paid.eq.true,has_video_subscription.eq.true,plan.eq.vip,plan.eq.premium,role.eq.admin');
    } else if (filter === 'free') {
      queryBuilder = queryBuilder
        .neq('role', 'admin')
        .or('is_video_paid.is.null,is_video_paid.eq.false')
        .or('has_video_subscription.is.null,has_video_subscription.eq.false')
        .neq('plan', 'vip')
        .neq('plan', 'premium');
    }

    const { data: users, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching admin users from Supabase:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      users: users || [],
      total: users?.length || 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Admin users API error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
