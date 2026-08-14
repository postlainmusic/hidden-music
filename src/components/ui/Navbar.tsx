'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogIn, UserCheck, LogOut, Disc3, ArrowLeft, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AuthModal from '@/components/ui/AuthModal';
import ProfileModal from '@/components/ui/ProfileModal';
import SettingsModal from '@/components/ui/SettingsModal';

interface NavbarProps {
  userEmail?: string | null;
  onLogout?: () => void;
  onOpenAuthModal?: (tab?: 'login' | 'register') => void;
  showBackButton?: boolean;
  title?: string;
}

import {
  getStoredUserSession,
  setStoredUserSession,
  getStoredAdminSession,
  clearAllStoredSessions,
  performLogout
} from '@/lib/authSession';

export default function Navbar({
  userEmail: propUserEmail,
  onLogout: propOnLogout,
  onOpenAuthModal: propOnOpenAuthModal,
  showBackButton = false,
  title,
}: NavbarProps) {
  const [mounted, setMounted] = useState(false);
  const [internalEmail, setInternalEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  
  // Separate states for Profile and Settings windows
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();

    const fetchUserData = async () => {
      try {
        let user: any = getStoredUserSession();

        if (!user) {
          const { data } = await supabase.auth.getUser();
          user = data?.user;
        }

        if (user) {
          setStoredUserSession(user);
          setInternalEmail(user.email || null);
          const initialName = user.display_name || user.user_metadata?.full_name || user.user_metadata?.display_name || user.user_metadata?.name || user.email?.split('@')[0] || 'VAULT MEMBER';
          setDisplayName(initialName.toUpperCase());

          if (user.id && user.id !== 'admin-master-id' && !user.id.startsWith('vault-')) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', user.id)
              .maybeSingle();

            if (profile?.display_name) {
              setDisplayName(profile.display_name.toUpperCase());
            }
          }
        }
      } catch (err) {
        console.error('Navbar auth error:', err);
      }
    };

    fetchUserData();

    // Event listener for instant client-side profile name updates
    const handleProfileUpdate = (e: any) => {
      const stored = getStoredUserSession();
      if (stored?.display_name) {
        setDisplayName(stored.display_name.toUpperCase());
      } else if (e?.detail?.display_name) {
        setDisplayName(e.detail.display_name.toUpperCase());
      }
    };

    window.addEventListener('vault_profile_updated', handleProfileUpdate);
    window.addEventListener('vault_auth_change', handleProfileUpdate);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setStoredUserSession(session.user);
        setInternalEmail(session.user.email || null);
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .maybeSingle();

        const storedCustomName = typeof window !== 'undefined' ? localStorage.getItem('hidden_vault_custom_name') : null;
        const name = storedCustomName || profile?.display_name || session.user.user_metadata?.display_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'VAULT MEMBER';
        setDisplayName(name.toUpperCase());
      } else {
        if (!getStoredAdminSession()) {
          const stored = getStoredUserSession();
          if (!stored) {
            setInternalEmail(null);
            setDisplayName(null);
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('vault_profile_updated', handleProfileUpdate);
      window.removeEventListener('vault_auth_change', handleProfileUpdate);
    };
  }, []);

  const isLoggedIn = Boolean(propUserEmail !== undefined ? propUserEmail : internalEmail);
  const userLabel = displayName || (internalEmail ? internalEmail.split('@')[0].toUpperCase() : 'VAULT MEMBER');

  const handleLogout = async () => {
    if (propOnLogout) {
      propOnLogout();
      return;
    }
    await performLogout();
  };

  const handleOpenAuth = (tab?: 'login' | 'register') => {
    if (propOnOpenAuthModal) {
      propOnOpenAuthModal(tab);
      return;
    }
    if (tab) setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 w-full px-2.5 sm:px-6 md:px-10 py-2.5 sm:py-4 md:py-6 z-30 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/95 via-black/70 to-transparent select-none">
        {/* Left: Logo + Optional Back Button */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {showBackButton && (
            <Link
              href="/"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all text-xs font-mono uppercase font-bold tracking-wider flex-shrink-0"
              title="Quay lại"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">BACK</span>
            </Link>
          )}

          <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 group min-w-0">
            <Disc3 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white animate-spin-slow group-hover:scale-110 transition-transform flex-shrink-0" />
            <span className={`font-extrabold text-xs sm:text-base md:text-lg text-white tracking-wider sm:tracking-widest font-cyber uppercase truncate ${showBackButton ? 'hidden xs:inline sm:inline' : 'inline'}`}>
              HIDDEN MUSIC
            </span>
          </Link>
        </div>

        {/* Center: Title if provided */}
        {title && (
          <div className="hidden md:flex items-center gap-2 text-slate-300 font-mono text-xs max-w-xs truncate">
            <span className="text-white/30">•</span>
            <span className="uppercase tracking-widest font-extrabold truncate text-white">{title}</span>
          </div>
        )}

        {/* Right: User Display Name Badge & Settings Button */}
        <div className="flex items-center gap-1 sm:gap-2 font-mono flex-shrink-0">
          {!mounted ? (
            <div className="h-7 w-16" />
          ) : isLoggedIn ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* BUTTON 1: USER DISPLAY NAME (OPENS PROFILE WINDOW) */}
              <button
                onClick={() => setProfileModalOpen(true)}
                title="Xem & Sửa Hồ sơ cá nhân"
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-[10px] sm:text-xs font-bold transition-all"
              >
                <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                <span className="max-w-[60px] xs:max-w-[80px] sm:max-w-[120px] truncate uppercase tracking-wider">{userLabel}</span>
              </button>

              {/* BUTTON 2: GEAR ICON (OPENS SETTINGS WINDOW) */}
              <button
                onClick={() => setSettingsModalOpen(true)}
                title="Cài đặt trình phát & giao diện"
                className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-white text-slate-300 hover:text-black border border-white/20 transition-all"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {/* BUTTON 3: SIGN OUT */}
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-red-900/60 border border-white/20 text-slate-300 hover:text-white transition-all"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <button
                onClick={() => handleOpenAuth()}
                title="Đăng nhập / Đăng ký"
                className="p-2 rounded-full bg-white text-black hover:bg-slate-200 transition-all flex items-center justify-center shadow-xl"
              >
                <LogIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {propOnOpenAuthModal === undefined && (
        <AuthModal
          isOpen={authModalOpen}
          initialTab={authModalTab}
          onClose={() => setAuthModalOpen(false)}
        />
      )}

      {/* DEDICATED PROFILE WINDOW */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onLogout={handleLogout}
      />

      {/* DEDICATED SETTINGS WINDOW */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </>
  );
}
