export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { trackId, videoOffset, syncMetadata } = await req.json();

    if (!trackId) {
      return NextResponse.json({ error: 'Thiếu trackId.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const updatePayload: Record<string, any> = {};
    if (typeof videoOffset === 'number') {
      updatePayload.video_offset = videoOffset;
    }
    if (syncMetadata) {
      updatePayload.sync_metadata = syncMetadata;
    }

    const { data, error } = await supabase
      .from('tracks')
      .update(updatePayload)
      .eq('id', trackId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      track: data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi xử lý đồng bộ bài hát.' }, { status: 500 });
  }
}
