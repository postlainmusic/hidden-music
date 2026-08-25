/**
 * POSTLAIN MUSIC - One-Click Database Sync Tool
 * Syncs all Albums and 30 Lossless Tracks from Supabase to PocketBase
 */

import { createClient } from '@supabase/supabase-js';
import PocketBase from 'pocketbase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZW13ZnF5bmZsanBtdnhtcGVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1MjAwNiwiZXhwIjoyMTAyMjI4MDA2fQ.XVTHN2DwdPtSBMVOzykbVtWtjUy0nDzashWPu5YdfRI';
const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://database.postlain.com';

const args = process.argv.slice(2);
let adminEmail = 'postlain.music@gmail.com';
let adminPassword = args[0] || 'Phuc2002';

if (args.length >= 2) {
  adminEmail = args[0];
  adminPassword = args[1];
}

async function runSync() {
  console.log('🚀 Đang khởi tạo kết nối Supabase & PocketBase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const pb = new PocketBase(POCKETBASE_URL);
  pb.autoCancellation(false);

  // 1. Đăng nhập PocketBase Superuser
  console.log(`🔐 Đang xác thực Superuser PocketBase (${adminEmail})...`);
  try {
    if (typeof pb.collection === 'function') {
      try {
        await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
      } catch {
        await pb.admins.authWithPassword(adminEmail, adminPassword);
      }
    } else {
      await pb.admins.authWithPassword(adminEmail, adminPassword);
    }
    console.log('✅ Đăng nhập PocketBase Superuser thành công!');
  } catch (err) {
    console.error('❌ Đăng nhập PocketBase thất bại:', err?.message || err);
    process.exit(1);
  }

  // 2. Lấy dữ liệu từ Supabase
  console.log('📦 Đang tải dữ liệu Albums & Tracks từ Supabase...');
  const { data: albums, error: albumErr } = await supabase.from('albums').select('*');
  const { data: tracks, error: trackErr } = await supabase.from('tracks').select('*').order('created_at', { ascending: true });

  if (albumErr || trackErr) {
    console.error('❌ Lỗi tải dữ liệu Supabase:', albumErr || trackErr);
    process.exit(1);
  }

  console.log(`📊 Tìm thấy: ${albums?.length || 0} Albums, ${tracks?.length || 0} Tracks.`);

  // 3. Đồng bộ Albums -> Playlists trong PocketBase
  const albumIdMap = new Map();
  for (const album of albums || []) {
    console.log(`📀 Đang đồng bộ Album: "${album.title}" (${album.artist})...`);
    try {
      const existing = await pb.collection('playlists').getList(1, 1, {
        filter: `title = "${album.title.replace(/"/g, '\\"')}"`,
      }).catch(() => ({ items: [] }));

      let pbAlbum;
      const albumData = {
        title: album.title,
        description: `Original Year: ${album.original_year || 2026} • Artist: ${album.artist || 'MCK'}`,
        is_public: album.is_published !== false,
      };

      if (existing.items && existing.items.length > 0) {
        pbAlbum = await pb.collection('playlists').update(existing.items[0].id, albumData);
        console.log(`   🔄 Đã cập nhật playlist ID: ${pbAlbum.id}`);
      } else {
        pbAlbum = await pb.collection('playlists').create(albumData);
        console.log(`   ✨ Đã tạo mới playlist ID: ${pbAlbum.id}`);
      }
      albumIdMap.set(album.id, pbAlbum.id);
    } catch (err) {
      console.warn(`   ⚠️ Không thể đồng bộ album "${album.title}":`, err?.message || err);
    }
  }

  // 4. Đồng bộ 30 Tracks -> PocketBase Tracks
  let successCount = 0;
  console.log('\n🎵 Đang đồng bộ 30 bài hát sang PocketBase...');
  for (const [index, track] of (tracks || []).entries()) {
    const trackName = track.title || `Track ${index + 1}`;
    console.log(`   [${index + 1}/${tracks.length}] Đồng bộ bài: "${trackName}"...`);

    const trackData = {
      title: track.title,
      artist: track.artist || 'MCK',
      album: track.album_id ? (albumIdMap.get(track.album_id) || 'HVL') : 'HVL',
      audio_url: track.audio_url || '',
      video_url: track.video_url || '',
      cover_url: track.cover_url || 'https://media.postlain.com/covers/1786876522318_1000058353.jpg',
      lyrics: track.lyrics || '',
      bpm: track.bpm || 0,
      duration: Math.round(track.duration || 0),
      genre: 'Hip-Hop / R&B',
      bitrate: 'FLAC 24-bit // LOSSLESS',
      plays_count: 0,
    };

    try {
      const existing = await pb.collection('tracks').getList(1, 1, {
        filter: `title = "${track.title.replace(/"/g, '\\"')}"`,
      }).catch(() => ({ items: [] }));

      if (existing.items && existing.items.length > 0) {
        await pb.collection('tracks').update(existing.items[0].id, trackData);
        console.log(`       🔄 Đã cập nhật track.`);
      } else {
        await pb.collection('tracks').create(trackData);
        console.log(`       ✨ Đã tạo mới track.`);
      }
      successCount++;
    } catch (err) {
      console.warn(`       ⚠️ Lỗi đồng bộ bài "${track.title}":`, err?.message || err);
    }
  }

  console.log(`\n🎉 HOÀN TẤT ĐỒNG BỘ: ${successCount}/${tracks?.length || 0} bài hát đã được đồng bộ vào PocketBase!`);
  console.log(`🌐 Xem dữ liệu tại: ${POCKETBASE_URL}/_/`);
}

runSync();
