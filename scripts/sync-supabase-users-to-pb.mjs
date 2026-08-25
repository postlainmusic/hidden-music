/**
 * POSTLAIN MUSIC - All 142 Users Migration Tool
 * Syncs all 142 Users + Profiles from Supabase to PocketBase
 */

import { createClient } from '@supabase/supabase-js';
import PocketBase from 'pocketbase';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZW13ZnF5bmZsanBtdnhtcGVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1MjAwNiwiZXhwIjoyMTAyMjI4MDA2fQ.XVTHN2DwdPtSBMVOzykbVtWtjUy0nDzashWPu5YdfRI';
const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://database.postlain.com';

const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncAllUsers() {
  console.log('🚀 Đang kết nối PocketBase với tài khoản Superuser...');
  await pb.collection('_superusers').authWithPassword('postlain.music@gmail.com', 'Phuc2002');
  console.log('✅ Đăng nhập Superuser thành công!');

  // 1. Đảm bảo bảng users có trường avatar_url
  try {
    const usersCol = await pb.collections.getOne('users');
    const uFieldNames = new Set(usersCol.fields.map((f) => f.name));
    if (!uFieldNames.has('avatar_url')) {
      usersCol.fields.push({ id: 'txt_usr_ava_url', name: 'avatar_url', type: 'text', required: false });
      await pb.collections.update('users', usersCol);
      console.log('✅ Đã bổ sung trường avatar_url vào bảng users.');
    }
  } catch (e) {
    console.warn('Lỗi kiểm tra avatar_url:', e?.message || e);
  }

  // 2. Tải toàn bộ 142 Users & Profiles từ Supabase
  console.log('📦 Đang tải 142 users và profiles từ Supabase...');
  const { data: userData, error: userErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const { data: profileList, error: profErr } = await supabase.from('profiles').select('*');

  if (userErr) {
    console.error('❌ Lỗi tải Supabase Users:', userErr);
    process.exit(1);
  }

  const profilesMap = new Map();
  for (const prof of profileList || []) {
    if (prof.id) profilesMap.set(prof.id, prof);
    if (prof.email) profilesMap.set(prof.email.toLowerCase(), prof);
  }

  const users = userData?.users || [];
  console.log(`📊 Bắt đầu đồng bộ ${users.length} tài khoản người dùng sang PocketBase...`);

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const [idx, u] of users.entries()) {
    const email = u.email ? u.email.toLowerCase() : '';
    if (!email) continue;

    const prof = profilesMap.get(u.id) || profilesMap.get(email) || {};
    const displayName = prof.display_name || u.user_metadata?.full_name || u.user_metadata?.name || email.split('@')[0];
    const avatarUrl = prof.avatar_url || u.user_metadata?.avatar_url || u.user_metadata?.picture || '';
    const role = prof.role || 'user';
    const plan = prof.plan || 'free';
    const hasVideo = prof.has_video_subscription === true;

    // Kiểm tra xem user đã có trên PocketBase chưa
    try {
      const existing = await pb.collection('users').getList(1, 1, {
        filter: `email = "${email.replace(/"/g, '\\"')}"`,
        requestKey: null,
      }).catch(() => ({ items: [] }));

      if (existing.items && existing.items.length > 0) {
        // Cập nhật thông tin profile cho user hiện có
        await pb.collection('users').update(existing.items[0].id, {
          name: displayName,
          avatar_url: avatarUrl,
          role,
          plan,
          has_video_subscription: hasVideo,
          verified: true,
        });
        updatedCount++;
        console.log(`[${idx + 1}/${users.length}] 🔄 Cập nhật: ${email} (${displayName})`);
      } else {
        // Tạo mới user
        const tempPassword = crypto.randomBytes(12).toString('hex') + 'A1!';
        await pb.collection('users').create({
          email,
          emailVisibility: true,
          verified: true,
          password: tempPassword,
          passwordConfirm: tempPassword,
          name: displayName,
          avatar_url: avatarUrl,
          role,
          plan,
          has_video_subscription: hasVideo,
        });
        createdCount++;
        console.log(`[${idx + 1}/${users.length}] ✨ Tạo mới: ${email} (${displayName})`);
      }
    } catch (err) {
      errorCount++;
      console.warn(`[${idx + 1}/${users.length}] ⚠️ Lỗi với user ${email}:`, err?.message || err);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`🎉 HOÀN TẤT ĐỒNG BỘ NGƯỜI DÙNG!`);
  console.log(`✨ Tạo mới: ${createdCount} users`);
  console.log(`🔄 Cập nhật: ${updatedCount} users`);
  console.log(`⚠️ Lỗi: ${errorCount} users`);
  console.log(`🌐 Kiểm tra danh sách người dùng tại: ${POCKETBASE_URL}/_/#/collections?collection=users`);
  console.log('='.repeat(50));
}

syncAllUsers();
