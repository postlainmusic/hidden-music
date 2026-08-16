'use client';

import React, { useEffect, useState } from 'react';
import {
  User,
  LogOut,
  CheckCircle,
  AlertCircle,
  Save,
  X,
  Sparkles,
  MessageSquare,
  Send,
  HelpCircle,
  Flame,
  Music2,
  Bug
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';

import {
  getStoredUserSession,
  setStoredUserSession,
  performLogout
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

    try {
      const supabase = createClient();
      const payload = {
        user_id: user?.id && !user.id.startsWith('vault-') ? user.id : null,
        user_email: user?.email || 'member@hiddenvault.com',
        user_name: displayName.trim() || user?.email?.split('@')[0] || 'Vault Member',
        category: feedbackCategory,
        content: feedbackContent.trim(),
        status: 'unread',
      };

      const { error } = await supabase.from('feedbacks').insert(payload);
      if (error) throw error;

      setFeedbackMsg({ type: 'success', text: 'Cảm ơn bạn! Ý kiến đóng góp đã được gửi trực tiếp tới Ban Quản Trị.' });
      setFeedbackContent('');
    } catch (err: any) {
      console.warn('Supabase feedback insert warning:', err);
      setFeedbackMsg({
        type: 'error',
        text: 'Lỗi gửi góp ý. Vui lòng thử lại sau.'
      });
    } finally {
      setFeedbackSending(false);
    }
  };

  const handleSignOut = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    await performLogout();
  };

  const isUserAdmin = profile?.role === 'admin' || user?.email === 'admin@hiddenvault.com';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-start justify-center sm:justify-end p-3 sm:pt-16 sm:pr-8 md:pr-14 select-none font-mono text-white transition-opacity duration-300"
    >
      <div className="bw-panel w-full max-w-[380px] rounded-3xl p-4 sm:p-5 border border-white/25 shadow-[0_20px_70px_rgba(0,0,0,0.85)] relative space-y-4 max-h-[88vh] overflow-y-auto font-mono animate-vaultPopOut bg-[#0c0c10]/95 backdrop-blur-2xl">
        
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
                {activeTab === 'profile' ? 'Thông tin tài khoản' : 'Đóng góp ý kiến cho Vault'}
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

        {/* TAB 1: PROFILE TAB */}
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
              <form onSubmit={handleSave} className="space-y-4 text-xs">
                {/* User Identity Card */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/15 space-y-3">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-12 h-12 rounded-2xl border-2 border-white/30 object-cover shadow-md"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-white font-extrabold text-base">
                        {(displayName.charAt(0) || 'V').toUpperCase()}
                      </div>
                    )}

                    <div className="space-y-1 truncate min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-xs text-white truncate font-cyber">
                          {displayName || 'Vault Listener'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold bg-white text-black uppercase tracking-wider">
                          {isUserAdmin ? 'ADMIN' : 'VAULT MEMBER'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{user?.email || 'member@hiddenvault.com'}</p>
                    </div>
                  </div>

                  {/* Display Name Input */}
                  <div>
                    <label className="block text-[10px] uppercase text-slate-400 mb-1 font-bold">
                      Tên hiển thị / Handle
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="VD: LUCIINGO"
                        className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 pl-8 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white transition-colors uppercase font-bold tracking-wider"
                      />
                      <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
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

            {/* Category Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase text-slate-400 font-bold">
                Danh mục góp ý
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'feature', label: 'Tính năng mới', icon: Flame },
                  { id: 'music_request', label: 'Yêu cầu nhạc/MV', icon: Music2 },
                  { id: 'bug', label: 'Báo lỗi / Bug', icon: Bug },
                  { id: 'other', label: 'Ý kiến khác', icon: HelpCircle },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = feedbackCategory === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFeedbackCategory(item.id as any)}
                      className={`p-2 rounded-xl text-left border flex items-center gap-1.5 transition-all text-[10px] font-bold ${
                        isSelected
                          ? 'bg-white text-black border-white shadow-md'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feedback Textarea */}
            <div className="space-y-1">
              <label className="block text-[10px] uppercase text-slate-400 font-bold">
                Nội dung chi tiết
              </label>
              <textarea
                rows={4}
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                placeholder="Nhập ý kiến đóng góp, bài hát muốn lưu trữ, hoặc lỗi bạn gặp phải..."
                className="w-full bg-black/60 border border-white/20 rounded-xl p-3 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={feedbackSending || !feedbackContent.trim()}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{feedbackSending ? 'ĐANG GỬI GÓP Ý...' : 'GỬI ĐẾN BAN QUẢN TRỊ'}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

