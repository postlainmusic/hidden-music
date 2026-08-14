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
  clearAllStoredSessions
} from '@/lib/authSession';

export default function Navbar({
  userEmail: propUserEmail,
  onLogout: propOnLogout,
  onOpenAuthModal: propOnOpenAuthModal,
  showBackButton = false,
  title,
}: NavbarProps) {
  const initialStored = typeof window !== 'undefined' ? getStoredUserSession() : null;
  const [internalEmail, setInternalEmail] = useState<string | null>(initialStored?.email || null);
  const [displayName, setDisplayName] = useState<string | null>(initialStored?.display_name?.toUpperCase() || null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  
  // Separate states for Profile and Settings windows
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  useEffect(() => {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setStoredUserSession(session.user);
        setInternalEmail(session.user.email || null);
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .maybeSingle();

        const name = profile?.display_name || session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'VAULT MEMBER';
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
    };
  }, []);

  const isLoggedIn = Boolean(propUserEmail !== undefined ? propUserEmail : internalEmail);
  const userLabel = displayName || (internalEmail ? internalEmail.split('@')[0].toUpperCase() : 'VAULT MEMBER');

  const handleLogout = async () => {
    if (propOnLogout) {
      propOnLogout();
      return;
    }
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearAllStoredSessions();
      window.location.href = '/';
    }
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
      <header className="fixed top-0 left-0 right-0 w-full px-3 md:px-10 py-3 md:py-6 z-30 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/90 via-black/50 to-transparent select-none">
        {/* Left: Logo + Optional Back Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          {showBackButton && (
            <Link
              href="/"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all text-xs font-mono uppercase"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">3D VAULT</span>
            </Link>
          )}

          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
            <Disc3 className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin-slow group-hover:scale-110 transition-transform" />
            <span className="font-extrabold text-sm sm:text-base md:text-lg text-white tracking-widest font-cyber uppercase">
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
        <div className="flex items-center gap-2 sm:gap-3 font-mono">
          {isLoggedIn ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* BUTTON 1: USER DISPLAY NAME (OPENS PROFILE WINDOW) */}
              <button
                onClick={() => setProfileModalOpen(true)}
                title="Xem & Sửa Hồ sơ cá nhân"
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-[11px] sm:text-xs font-bold transition-all hover:scale-105"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span className="max-w-[90px] sm:max-w-[140px] truncate uppercase tracking-wider">{userLabel}</span>
              </button>

              {/* BUTTON 2: GEAR ICON (OPENS SETTINGS WINDOW) */}
              <button
                onClick={() => setSettingsModalOpen(true)}
                title="Cài đặt trình phát & giao diện"
                className="p-2 rounded-full bg-white/10 hover:bg-white text-slate-300 hover:text-black border border-white/20 transition-all hover:scale-105"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* BUTTON 3: SIGN OUT */}
              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="p-2 rounded-full bg-white/10 hover:bg-red-900/60 border border-white/20 text-slate-300 hover:text-white transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <button
                onClick={() => handleOpenAuth()}
                title="Đăng nhập / Đăng ký"
                className="p-2.5 rounded-full bg-white text-black hover:bg-slate-200 transition-all flex items-center justify-center shadow-xl hover:scale-105"
              >
                <LogIn className="w-4 h-4" />
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
