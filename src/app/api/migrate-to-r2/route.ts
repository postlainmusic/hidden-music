import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToR2 } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const log: string[] = [];
  const results = {
    albumsMigrated: 0,
    tracksMigrated: 0,
    storageFilesMigrated: 0,
    errors: [] as string[],
    logs: log,
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseKey) {
    return NextResponse.json({ error: 'Supabase Key missing in environment' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    log.push('🚀 Bắt đầu di chuyển dữ liệu từ Supabase sang Cloudflare R2...');

    // 1. MIGRATE ALBUMS COVER ARTS
    const { data: albums, error: albErr } = await supabase.from('albums').select('*');
    if (albErr) {
      log.push(`⚠️ Không thể tải danh sách albums: ${albErr.message}`);
    } else if (albums && albums.length > 0) {
      log.push(`📦 Tìm thấy ${albums.length} albums trong database.`);

      for (const alb of albums) {
        if (alb.cover_url && (alb.cover_url.includes('supabase.co') || alb.cover_url.includes('storage/v1/object/public'))) {
          try {
            log.push(`🖼️ Đang tải ảnh bìa album "${alb.title}" (${alb.id})...`);
            const res = await fetch(alb.cover_url);
            if (res.ok) {
              const arrayBuf = await res.arrayBuffer();
              const buffer = Buffer.from(arrayBuf);
              const contentType = res.headers.get('content-type') || 'image/jpeg';
              const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

              const r2Key = `covers/${alb.id}_cover.${ext}`;
              const r2Url = await uploadToR2(r2Key, buffer, contentType);

              // Update album record
              await supabase.from('albums').update({ cover_url: r2Url }).eq('id', alb.id);
              results.albumsMigrated++;
              log.push(`✅ Đã chuyển ảnh bìa album "${alb.title}" -> ${r2Url}`);
            } else {
              log.push(`⚠️ Không thể tải ảnh từ link cũ (${res.status}): ${alb.cover_url}`);
            }
          } catch (e: any) {
            results.errors.push(`Lỗi chuyển ảnh bìa album ${alb.id}: ${e.message}`);
            log.push(`❌ Lỗi album ${alb.id}: ${e.message}`);
          }
        }
      }
    }

    // 2. MIGRATE TRACKS AUDIO FILES
    const { data: tracks, error: trkErr } = await supabase.from('tracks').select('*');
    if (trkErr) {
      log.push(`⚠️ Không thể tải danh sách tracks: ${trkErr.message}`);
    } else if (tracks && tracks.length > 0) {
      log.push(`🎵 Tìm thấy ${tracks.length} bài hát trong database.`);

      for (const trk of tracks) {
        const audioUrl = trk.audio_url || trk.url || '';
        if (audioUrl && (audioUrl.includes('supabase.co') || audioUrl.includes('storage/v1/object/public'))) {
          try {
            log.push(`🎧 Đang tải file nhạc "${trk.title}" (${trk.id})...`);
            const res = await fetch(audioUrl);
            if (res.ok) {
              const arrayBuf = await res.arrayBuffer();
              const buffer = Buffer.from(arrayBuf);
              const contentType = res.headers.get('content-type') || 'audio/mpeg';
              const ext = contentType.includes('wav') ? 'wav' : contentType.includes('flac') ? 'flac' : 'mp3';

              const cleanTitle = trk.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
              const r2Key = `audio/${trk.id}_${cleanTitle}.${ext}`;
              const r2Url = await uploadToR2(r2Key, buffer, contentType);

              // Update track record (handles both audio_url and url columns)
              const updatePayload: Record<string, any> = { audio_url: r2Url };
              let { error: updErr } = await supabase.from('tracks').update(updatePayload).eq('id', trk.id);

              if (updErr && updErr.message?.includes('audio_url')) {
                await supabase.from('tracks').update({ url: r2Url }).eq('id', trk.id);
              }

              results.tracksMigrated++;
              log.push(`✅ Đã chuyển bài hát "${trk.title}" -> ${r2Url}`);
            } else {
              log.push(`⚠️ Không thể tải file nhạc từ link cũ (${res.status}): ${audioUrl}`);
            }
          } catch (e: any) {
            results.errors.push(`Lỗi chuyển bài hát ${trk.id}: ${e.message}`);
            log.push(`❌ Lỗi bài hát ${trk.id}: ${e.message}`);
          }
        }
      }
    }

    // 3. SCAN SUPABASE STORAGE BUCKETS (Extra fallback for unlinked files)
    const candidateBuckets = ['cover-arts', 'audio-files', 'audio'];
    for (const bName of candidateBuckets) {
      try {
        const { data: fileList } = await supabase.storage.from(bName).list();
        if (fileList && fileList.length > 0) {
          log.push(`📂 Đang quét Supabase bucket "${bName}" (${fileList.length} tệp)...`);
          for (const item of fileList) {
            if (item.name && !item.name.startsWith('.')) {
              try {
                const { data: downloadData, error: dlErr } = await supabase.storage.from(bName).download(item.name);
                if (!dlErr && downloadData) {
                  const arrayBuf = await downloadData.arrayBuffer();
                  const buffer = Buffer.from(arrayBuf);
                  const contentType = downloadData.type || 'application/octet-stream';
                  const r2Key = `${bName}/${item.name}`;

                  await uploadToR2(r2Key, buffer, contentType);
                  results.storageFilesMigrated++;
                  log.push(`💾 Đã sao chép tệp bucket: ${r2Key}`);
                }
              } catch (fileErr: any) {
                log.push(`⚠️ Bỏ qua tệp ${item.name}: ${fileErr.message}`);
              }
            }
          }
        }
      } catch (bucketErr: any) {
        log.push(`ℹ️ Bucket "${bName}" không có hoặc không thể truy cập: ${bucketErr.message}`);
      }
    }

    log.push('🎉 HOÀN TẤT DI CHUYỂN TOÀN BỘ DỮ LIỆU SANG CLOUDFLARE R2!');
    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`❌ Lỗi tổng quan: ${msg}`);
    return NextResponse.json({
      success: false,
      error: msg,
      ...results,
    }, { status: 500 });
  }
}
