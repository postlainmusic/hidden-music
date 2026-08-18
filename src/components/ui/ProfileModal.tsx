'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  User,
  LogOut,
  CheckCircle,
  AlertCircle,
  Save,
  X,
  Sparkles,
  MessageSquare,
  Crown,
  Zap,
  ShieldCheck,
  Film,
  Music2,
  Lock,
  Unlock,
  Calendar,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';

import {
  getStoredUserSession,
  setStoredUserSession,
  clearAllStoredSessions,
  performLogout,
  hasVideoSubscription,
} from '@/lib/authSession';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export default function ProfileModal({ isOpen, onClose, onLogout }: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'feedback'>('profile');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Feedback Form State
  const [feedbackCategory, setFeedbackCategory] = useState<'feature' | 'bug' | 'music_request' | 'other'>('feature');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadProfile = async () => {
      setMsg(null);
      setFeedbackMsg(null);
      try {
        let currentUser: any = getStoredUserSession();

        if (!currentUser) {
          const supabase = createClient();
          const { data } = await supabase.auth.getUser();
          currentUser = data?.user;
        }

        if (!currentUser) {
          currentUser = {
            id: 'vault-member-id',
            email: 'member@hiddenvault.com',
            display_name: 'VAULT MEMBER',
            role: 'user',
          };
        }

        setUser(currentUser);
        const storedCustomName = typeof window !== 'undefined' ? localStorage.getItem('hidden_vault_custom_name') : null;
        const initialName =
          storedCustomName ||
          currentUser.display_name ||
          currentUser.user_metadata?.display_name ||
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          currentUser.email?.split('@')[0] ||
          'Vault Listener';
        const initialAvatar = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || '';
        setDisplayName(initialName);
        setAvatarUrl(initialAvatar);

        if (currentUser.id && currentUser.id !== 'admin-master-id' && !currentUser.id.startsWith('vault-')) {
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id);
          if (isValidUUID) {
            const supabase = createClient();
            const { data: dbProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle();

            if (dbProfile) {
              setProfile(dbProfile);
              if (dbProfile.display_name && !storedCustomName) {
                setDisplayName(dbProfile.display_name);
              }
              if (dbProfile.avatar_url) setAvatarUrl(dbProfile.avatar_url);
            }
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [isOpen]);

  // Subscription Plan Analysis
  const isUserAdmin = useMemo(() => {
    return profile?.role === 'admin' || user?.role === 'admin' || user?.email === 'admin@hiddenvault.com';
  }, [profile, user]);

  const isVipPaid = useMemo(() => {
    if (isUserAdmin) return true;
    if (hasVideoSubscription(user)) return true;
    if (profile?.is_video_paid || profile?.has_video_subscription) return true;
    if (profile?.plan === 'vip' || profile?.plan === 'premium') return true;
    if (user?.plan === 'vip' || user?.plan === 'premium') return true;
    if (typeof window !== 'undefined' && localStorage.getItem('hidden_vault_video_pass') === 'true') return true;
    return false;
  }, [isUserAdmin, user, profile]);

  const planCategory = useMemo<'admin' | 'lifetime' | 'monthly' | 'free'>(() => {
    if (isUserAdmin) return 'admin';
    if (profile?.plan === 'vip' || user?.plan === 'vip') return 'monthly';
    if (profile?.plan === 'premium' || user?.plan === 'premium' || isVipPaid) return 'lifetime';
    return 'free';
  }, [isUserAdmin, profile, user, isVipPaid]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const updatedName = displayName.trim() || user?.email?.split('@')[0] || 'VAULT MEMBER';

    try {
      // 1. Instantly save to local storage & auth session (0ms delay)
      if (typeof window !== 'undefined') {
        localStorage.setItem('hidden_vault_custom_name', updatedName);
      }

      const updatedUserObj = {
        ...(user || {}),
        display_name: updatedName,
        user_metadata: {
          ...(user?.user_metadata || {}),
          display_name: updatedName,
          full_name: updatedName,
          name: updatedName,
        },
      };

      setStoredUserSession(updatedUserObj);
      setUser(updatedUserObj);

      // Dispatch global events for instant reactive navbar & layout sync
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vault_profile_updated', { detail: { display_name: updatedName } }));
        window.dispatchEvent(new CustomEvent('vault_auth_change', { detail: updatedUserObj }));
      }

      // 2. Non-blocking asynchronous sync with Supabase (max 2 seconds safety timeout)
      if (user?.id && !user.id.startsWith('vault-') && user.id !== 'admin-master-id') {
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
        if (isValidUUID) {
          const supabase = createClient();
          
          // Sync Auth user metadata
          try {
            await Promise.race([
              supabase.auth.updateUser({
                data: { display_name: updatedName, full_name: updatedName, name: updatedName }
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Auth update timeout')), 2000))
            ]);
          } catch (authErr) {
            console.warn('Supabase auth metadata update notice:', authErr);
          }

          // Sync database profiles table
          try {
            await Promise.race([
              supabase.from('profiles').upsert({
                id: user.id,
                email: user.email,
                display_name: updatedName,
                avatar_url: avatarUrl || null,
                role: profile?.role || 'user',
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Profile DB update timeout')), 2000))
            ]);
          } catch (dbErr) {
            console.warn('Supabase profiles DB update notice:', dbErr);
          }
        }
      }

      setMsg({ type: 'success', text: 'Cập nhật tên hiển thị thành công!' });
      setTimeout(() => {
        setSaving(false);
        onClose();
      }, 500);
    } catch (err: unknown) {
      console.error('Error saving profile:', err);
      const errorText = err instanceof Error ? err.message : 'Không thể lưu hồ sơ.';
      setMsg({ type: 'error', text: errorText });
      setSaving(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackContent.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Vui lòng nhập nội dung góp ý của bạn!' });
      return;
    }

    setFeedbackSending(true);
    setFeedbackMsg(null);

    const payload = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'fb_' + Date.now(),
      user_id: user?.id && !user.id.startsWith('vault-') ? user.id : null,
      user_email: user?.email || 'member@hiddenvault.com',
      user_name: displayName.trim() || user?.email?.split('@')[0] || 'Vault Member',
      category: feedbackCategory,
      content: feedbackContent.trim(),
      status: 'unread',
      created_at: new Date().toISOString(),
    };

    // 1. Try remote Supabase insert
    try {
      const supabase = createClient();
      await supabase.from('feedbacks').insert(payload);
    } catch (err: any) {
      console.warn('Supabase feedback insert notice:', err);
    }

    // 2. Persist to local storage fallback cache so feedback is NEVER lost and Admin can view immediately
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('hidden_vault_local_feedbacks');
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(payload);
        localStorage.setItem('hidden_vault_local_feedbacks', JSON.stringify(list.slice(0, 100)));
      }
    } catch (e) {
      console.warn('LocalStorage save notice:', e);
    }

    setFeedbackMsg({
      type: 'success',
      text: 'Cảm ơn bạn! Ý kiến đóng góp đã được gửi trực tiếp tới Ban Quản Trị.'
    });
    setFeedbackContent('');
    setFeedbackSending(false);
  };

  const handleSignOut = async () => {
    clearAllStoredSessions();
    if (onLogout) {
      onLogout();
    }
    await performLogout();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-start justify-center sm:justify-end p-3 sm:pt-16 sm:pr-8 md:pr-14 select-none font-mono text-white transition-opacity duration-300"
    >
      <div className="bw-panel w-full max-w-[400px] rounded-3xl p-4 sm:p-5 border border-white/25 shadow-[0_25px_80px_rgba(0,0,0,0.95)] relative space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar font-mono animate-vaultPopOut bg-[#0c0c10]/95 backdrop-blur-2xl">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              {activeTab === 'profile' ? (
                <User className="w-3.5 h-3.5 text-white" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-cyber">
                {activeTab === 'profile' ? 'HỒ SƠ CÁ NHÂN' : 'GỬI GÓP Ý & BÁO LỖI'}
              </h3>
              <p className="text-[9px] text-slate-400 font-mono">
                {activeTab === 'profile' ? 'Thông tin & Gói đăng ký' : 'Đóng góp ý kiến cho Vault'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Đóng"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors flex items-center justify-center text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switch Buttons */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-black/60 border border-white/15">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setMsg(null);
            }}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'profile'
                ? 'bg-white text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3 h-3" />
            <span>HỒ SƠ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('feedback');
              setFeedbackMsg(null);
            }}
            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'feedback'
                ? 'bg-white text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            <span>GỬI GÓP Ý</span>
          </button>
        </div>

        {/* TAB 1: PROFILE & SUBSCRIPTION TAB */}
        {activeTab === 'profile' && (
          <>
            {/* Message Status */}
            {msg && (
              <div
                className={`p-3 rounded-2xl text-[11px] flex items-center gap-2 ${
                  msg.type === 'success'
                    ? 'bg-white/15 border border-white/40 text-white'
                    : 'bg-red-950/60 border border-red-500/40 text-red-300'
                }`}
              >
                {msg.type === 'success' ? (
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                )}
                <span>{msg.text}</span>
              </div>
            )}

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <Sparkles className="w-5 h-5 animate-spin" />
                <span>ĐANG TẢI HỒ SƠ...</span>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-3.5 text-xs">
                {/* 1. User Identity Card */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/15 space-y-3">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-11 h-11 rounded-2xl border-2 border-white/30 object-cover shadow-md"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-white font-extrabold text-base">
                        {(displayName.charAt(0) || 'V').toUpperCase()}
                      </div>
                    )}

                    <div className="space-y-0.5 truncate min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-xs text-white truncate font-cyber">
                          {displayName || 'Vault Listener'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[8px] font-extrabold bg-white text-black uppercase tracking-wider">
                          {isUserAdmin ? 'ADMIN' : isVipPaid ? 'VIP' : 'MEMBER'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate font-mono">{user?.email || 'member@hiddenvault.com'}</p>
                    </div>
                  </div>

                  {/* Display Name Input */}
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1 font-bold">
                      Tên hiển thị / Handle
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="VD: LUCIINGO"
                        className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 pl-8 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white transition-colors uppercase font-bold tracking-wider"
                      />
                      <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                    </div>
                  </div>
                </div>

                {/* 2. DEDICATED SUBSCRIPTION STATUS CARD */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/20 space-y-2.5 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-1.5">
                      {planCategory === 'admin' ? (
                        <ShieldCheck className="w-4 h-4 text-white" />
                      ) : planCategory === 'lifetime' ? (
                        <Crown className="w-4 h-4 text-amber-300" />
                      ) : planCategory === 'monthly' ? (
                        <Zap className="w-4 h-4 text-yellow-300" />
                      ) : (
                        <Music2 className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-[10px] font-extrabold uppercase font-cyber tracking-widest text-white">
                        GÓI ĐĂNG KÝ HIỆN TẠI
                      </span>
                    </div>

                    {/* Plan Badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider font-mono border ${
                      planCategory === 'admin'
                        ? 'bg-white text-black border-white shadow-md'
                        : planCategory === 'lifetime'
                        ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                        : planCategory === 'monthly'
                        ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40'
                        : 'bg-white/10 text-slate-300 border-white/15'
                    }`}>
                      {planCategory === 'admin'
                        ? '👑 QUẢN TRỊ VIÊN'
                        : planCategory === 'lifetime'
                        ? '✨ TRỌN ĐỜI VIP'
                        : planCategory === 'monthly'
                        ? '⚡ GÓI THÁNG VIP'
                        : '🎵 MIỄN PHÍ'}
                    </span>
                  </div>

                  {/* Plan Features & Access Details */}
                  <div className="space-y-1.5 text-[10px] text-slate-300 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Film className="w-3 h-3 text-slate-400" />
                        Video Zone (MV Hiếm):
                      </span>
                      <span className={`font-bold flex items-center gap-1 ${isVipPaid ? 'text-white' : 'text-slate-500'}`}>
                        {isVipPaid ? (
                          <>
                            <Unlock className="w-3 h-3 text-white" />
                            ĐÃ MỞ KHÓA
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-slate-500" />
                            CHƯA MỞ KHÓA
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Music2 className="w-3 h-3 text-slate-400" />
                        Chất lượng Âm thanh:
                      </span>
                      <span className="font-bold text-white">Lossless FLAC Master</span>
                    </div>

                    {isVipPaid && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[9px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          Thời hạn:
                        </span>
                        <span className="font-bold text-white uppercase">
                          {planCategory === 'admin' || planCategory === 'lifetime'
                            ? 'Vĩnh viễn (Lifetime)'
                            : '30 ngày'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* If Free User: Show Upgrade Call to Action */}
                  {!isVipPaid && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.dispatchEvent(new CustomEvent('open_vault_paywall'));
                      }}
                      className="w-full mt-1.5 py-2 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5 fill-black" />
                      <span>MỞ KHÓA VIDEO ZONE (VOUCHER / PAYOS)</span>
                    </button>
                  )}
                </div>

                {/* 3. Action Buttons */}
                <div className="pt-1 space-y-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'ĐANG LƯU HỒ SƠ...' : 'LƯU TÊN HIỂN THỊ'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full py-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-500/25 text-red-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ĐĂNG XUẤT KHỎI VAULT</span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* TAB 2: FEEDBACK TAB */}
        {activeTab === 'feedback' && (
          <form onSubmit={handleSubmitFeedback} className="space-y-3.5 text-xs">
            {/* Feedback Message Status */}
            {feedbackMsg && (
              <div
                className={`p-3 rounded-2xl text-[11px] flex items-center gap-2 ${
                  feedbackMsg.type === 'success'
                    ? 'bg-white/15 border border-white/40 text-white'
                    : 'bg-red-950/60 border border-red-500/40 text-red-300'
                }`}
              >
                {feedbackMsg.type === 'success' ? (
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-white" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] uppercase text-slate-400 font-bold">
                Danh mục góp ý
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'feature', label: 'TÍNH NĂNG MỚI' },
                  { id: 'bug', label: 'BÁO LỖI / BUG' },
                  { id: 'music_request', label: 'YÊU CẦU NHẠC / MV' },
                  { id: 'other', label: 'GÓP Ý KHÁC' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFeedbackCategory(cat.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      feedbackCategory === cat.id
                        ? 'bg-white text-black border-white shadow-md'
                        : 'bg-black/50 border-white/15 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase text-slate-400 font-bold">
                Nội dung chi tiết
              </label>
              <textarea
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                placeholder="Nhập chi tiết ý kiến, bài hát muốn bổ sung hoặc lỗi bạn gặp phải..."
                rows={4}
                className="w-full bg-black/60 border border-white/20 rounded-xl p-2.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={feedbackSending}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <span>{feedbackSending ? 'ĐANG GỬI Ý KIẾN...' : 'GỬI GÓP Ý TỚI ADMIN'}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
