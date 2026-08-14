'use client';

import React, { useEffect, useState } from 'react';
import {
  User,
  LogOut,
  CheckCircle,
  AlertCircle,
  Save,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';

import {
  getStoredUserSession,
  setStoredUserSession,
  getStoredAdminSession,
  clearAllStoredSessions,
  performLogout
} from '@/lib/authSession';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export default function ProfileModal({ isOpen, onClose, onLogout }: ProfileModalProps) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadProfile = async () => {
      setMsg(null);
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

  const handleSignOut = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    await performLogout();
  };

  const isUserAdmin = profile?.role === 'admin' || user?.email === 'admin@hiddenvault.com';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-3 sm:p-4 select-none font-mono text-white">
      <div className="bw-panel w-full max-w-md rounded-3xl p-5 sm:p-7 border border-white/30 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto font-mono">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-cyber">
                HỒ SƠ CÁ NHÂN
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Thông tin tài khoản Vault Member</p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Đóng"
            className="p-2 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline font-bold">TRỞ LẠI</span>
          </button>
        </div>

        {/* Message Status */}
        {msg && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
              msg.type === 'success'
                ? 'bg-white/15 border border-white/40 text-white'
                : 'bg-red-950/60 border border-red-500/40 text-red-300'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-white" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <Sparkles className="w-6 h-6 animate-spin" />
            <span>ĐANG TẢI HỒ SƠ...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5 text-xs">
            
            {/* User Identity Card */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/15 space-y-4">
              <div className="flex items-center gap-3.5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-14 h-14 rounded-2xl border-2 border-white/30 object-cover shadow-lg"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-white font-extrabold text-lg">
                    {(displayName.charAt(0) || 'V').toUpperCase()}
                  </div>
                )}

                <div className="space-y-1 truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white truncate font-cyber">
                      {displayName || 'Vault Listener'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-white text-black uppercase tracking-wider">
                      {isUserAdmin ? 'ADMIN' : 'VAULT MEMBER'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Display Name Input */}
              <div>
                <label className="block text-[11px] uppercase text-slate-400 mb-1.5 font-bold">
                  Tên hiển thị / Handle
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="VD: LUCIINGO"
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 pl-9 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white transition-colors uppercase font-bold tracking-wider"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'ĐANG LƯU HỒ SƠ...' : 'LƯU TÊN HIỂN THỊ'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>TRỞ LẠI</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ĐĂNG XUẤT</span>
                </button>
              </div>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
