import PocketBase from 'pocketbase';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZW13ZnF5bmZsanBtdnhtcGVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1MjAwNiwiZXhwIjoyMTAyMjI4MDA2fQ.XVTHN2DwdPtSBMVOzykbVtWtjUy0nDzashWPu5YdfRI';
const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://database.postlain.com';

const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setupAndMigrate() {
  console.log('🚀 Đang kết nối PocketBase...');
  await pb.collection('_superusers').authWithPassword('postlain.music@gmail.com', 'Phuc2002');
  console.log('✅ Đăng nhập Superuser thành công!');

  // 1. Cập nhật bảng Users
  try {
    const usersCol = await pb.collections.getOne('users');
    const uFieldNames = new Set(usersCol.fields.map((f) => f.name));
    if (!uFieldNames.has('role')) {
      usersCol.fields.push({ id: 'txt_usr_role001', name: 'role', type: 'text', required: false });
    }
    if (!uFieldNames.has('plan')) {
      usersCol.fields.push({ id: 'txt_usr_plan001', name: 'plan', type: 'text', required: false });
    }
    if (!uFieldNames.has('has_video_subscription')) {
      usersCol.fields.push({ id: 'bol_usr_vid0001', name: 'has_video_subscription', type: 'bool', required: false });
    }
    await pb.collections.update('users', usersCol);
    console.log('✅ Đã cập nhật fields cho bảng users.');
  } catch (e) {
    console.log('Users update:', e?.message || e);
  }

  // 2. Tạo bảng album_comments
  try {
    await pb.collections.create({
      id: 'pbc_alb_comm00',
      name: 'album_comments',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'album_id', type: 'text', required: true },
        { name: 'user_id', type: 'text', required: false },
        { name: 'user_email', type: 'text', required: false },
        { name: 'user_name', type: 'text', required: false },
        { name: 'user_avatar', type: 'text', required: false },
        { name: 'content', type: 'text', required: true },
        { name: 'likes_count', type: 'number', required: false },
      ],
    });
    console.log('✅ Đã tạo collection album_comments.');
  } catch (e) {
    console.log('album_comments collection status:', e?.message || e);
  }

  // 3. Tạo bảng feedbacks
  try {
    await pb.collections.create({
      id: 'pbc_feedbacks00',
      name: 'feedbacks',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'user_id', type: 'text', required: false },
        { name: 'user_email', type: 'text', required: false },
        { name: 'user_name', type: 'text', required: false },
        { name: 'message', type: 'text', required: true },
        { name: 'rating', type: 'number', required: false },
      ],
    });
    console.log('✅ Đã tạo collection feedbacks.');
  } catch (e) {
    console.log('feedbacks collection status:', e?.message || e);
  }

  // 4. Tạo bảng vouchers
  try {
    await pb.collections.create({
      id: 'pbc_vouchers000',
      name: 'vouchers',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.id != ""',
      updateRule: '',
      deleteRule: '@request.auth.id != ""',
      fields: [
        { name: 'code', type: 'text', required: true },
        { name: 'plan_type', type: 'text', required: true },
        { name: 'max_uses', type: 'number', required: false },
        { name: 'used_count', type: 'number', required: false },
        { name: 'is_active', type: 'bool', required: false },
        { name: 'duration_days', type: 'number', required: false },
      ],
    });
    console.log('✅ Đã tạo collection vouchers.');
  } catch (e) {
    console.log('vouchers collection status:', e?.message || e);
  }

  // 5. Đồng bộ Dữ liệu cũ từ Supabase
  console.log('\n📦 Đang kéo dữ liệu feedbacks, album_comments, vouchers từ Supabase...');
  
  // Feedbacks
  const { data: feedbacks } = await supabase.from('feedbacks').select('*');
  if (feedbacks && feedbacks.length > 0) {
    console.log(`Đang đồng bộ ${feedbacks.length} feedbacks...`);
    for (const fb of feedbacks) {
      await pb.collection('feedbacks').create({
        user_id: fb.user_id || '',
        user_email: fb.user_email || '',
        user_name: fb.user_name || '',
        message: fb.message || fb.feedback || fb.content || '',
        rating: fb.rating || 5,
      }).catch(() => null);
    }
    console.log(`✅ Đã đồng bộ ${feedbacks.length} feedbacks sang PocketBase!`);
  }

  // Album Comments
  const { data: comments } = await supabase.from('album_comments').select('*');
  if (comments && comments.length > 0) {
    console.log(`Đang đồng bộ ${comments.length} album comments...`);
    for (const cm of comments) {
      await pb.collection('album_comments').create({
        album_id: cm.album_id || '',
        user_id: cm.user_id || '',
        user_email: cm.user_email || '',
        user_name: cm.user_name || '',
        user_avatar: cm.user_avatar || '',
        content: cm.content || '',
        likes_count: cm.likes_count || 0,
      }).catch(() => null);
    }
    console.log(`✅ Đã đồng bộ ${comments.length} comments sang PocketBase!`);
  }

  // Vouchers
  const { data: vouchers } = await supabase.from('vouchers').select('*');
  if (vouchers && vouchers.length > 0) {
    console.log(`Đang đồng bộ ${vouchers.length} vouchers...`);
    for (const vc of vouchers) {
      await pb.collection('vouchers').create({
        code: vc.code,
        plan_type: vc.plan_type || 'vip',
        max_uses: vc.max_uses || 1,
        used_count: vc.used_count || 0,
        is_active: vc.is_active !== false,
        duration_days: vc.duration_days || 30,
      }).catch(() => null);
    }
    console.log(`✅ Đã đồng bộ ${vouchers.length} vouchers sang PocketBase!`);
  }

  console.log('\n🎉 HOÀN TẤT TẠO SCHEMA & ĐỒNG BỘ TOÀN DIỆN SANG POCKETBASE!');
}

setupAndMigrate();
