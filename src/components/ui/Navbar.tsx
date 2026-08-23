'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserCheck, LogOut, Disc3, ArrowLeft, Settings, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AuthModal from '@/components/ui/AuthModal';
import ProfileModal from '@/components/ui/ProfileModal';
import SettingsModal from '@/components/ui/SettingsModal';
import {
  getStoredUserSession,
  setStoredUserSession,
  getStoredAdminSession,
  clearAllStoredSessions,
  performLogout
} from '@/lib/authSession';
import { buttonTapMotion, subtleButtonTapMotion, iconButtonMotion, springSnappy } from '@/lib/motionVariants';

interface NavbarProps {
  userEmail?: string | null;
  onLogout?: () => void;
  onOpenAuthModal?: (tab?: 'login' | 'register') => void;
  showBackButton?: boolean;
  onBackClick?: () => void;
  title?: string;
}

export default function Navbar({
  userEmail: propUserEmail,
  onLogout: propOnLogout,
  onOpenAuthModal: propOnOpenAuthModal,
  showBackButton = false,
  onBackClick,
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

    const syncUserData = () => {
      const user = getStoredUserSession();
      if (user) {
        setInternalEmail(user.email || null);
        const name = user.display_name || user.user_metadata?.full_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'VAULT MEMBER';
        setDisplayName(name.toUpperCase());
      } else {
        setInternalEmail(null);
        setDisplayName(null);
      }
    };

    syncUserData();

    // Event listeners for profile and auth changes
    window.addEventListener('vault_profile_updated', syncUserData);
    window.addEventListener('vault_auth_change', syncUserData);
    window.addEventListener('storage', syncUserData);

    return () => {
      window.removeEventListener('vault_profile_updated', syncUserData);
      window.removeEventListener('vault_auth_change', syncUserData);
      window.removeEventListener('storage', syncUserData);
    };
  }, []);

  const isLoggedIn = Boolean(propUserEmail !== undefined ? propUserEmail : internalEmail);
  const userLabel = displayName || (internalEmail ? internalEmail.split('@')[0].toUpperCase() : 'VAULT MEMBER');

  const handleLogout = async () => {
    setInternalEmail(null);
    setDisplayName(null);
    if (propOnLogout) {
      try {
        await propOnLogout();
      } catch {}
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
            <motion.button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (onBackClick) {
                  onBackClick();
                } else {
                  window.location.href = '/';
                }
              }}
              {...subtleButtonTapMotion}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors text-xs font-mono uppercase font-bold tracking-wider flex-shrink-0 cursor-pointer"
              title="Quay lại"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">BACK</span>
            </motion.button>
          )}

          <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 group min-w-0">
            <motion.div
              whileHover={{ rotate: 90, scale: 1.15 }}
              transition={springSnappy}
              className="flex items-center justify-center flex-shrink-0"
            >
              <Disc3 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white animate-spin-slow" />
            </motion.div>
            <span className={`font-extrabold text-xs sm:text-base md:text-lg text-white tracking-wider sm:tracking-widest font-cyber uppercase truncate ${showBackButton ? 'hidden xs:inline sm:inline' : 'inline'}`}>
              HIDDEN MUSIC
            </span>
          </Link>
        </div>

        {/* Center: Title or Discover Link */}
        <div className="flex items-center gap-2 sm:gap-3">
          <motion.div {...subtleButtonTapMotion}>
            <Link
              href="/discover"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-sm"
              title="AI Multimedia Discovery Feed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">DISCOVERY FEED</span>
              <span className="sm:hidden">FEED</span>
            </Link>
          </motion.div>

          {title && (
            <div className="hidden md:flex items-center gap-2 text-slate-300 font-mono text-xs max-w-xs truncate">
              <span className="text-white/30">•</span>
              <span className="uppercase tracking-widest font-extrabold truncate text-white">{title}</span>
            </div>
          )}
        </div>

        {/* Right: User Display Name Badge & Settings Button */}
        <div className="flex items-center gap-1 sm:gap-2 font-mono flex-shrink-0">
          {!mounted ? (
            <div className="h-7 w-16" />
          ) : isLoggedIn ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* BUTTON 1: USER DISPLAY NAME (OPENS PROFILE WINDOW) */}
              <motion.button
                onClick={() => setProfileModalOpen(true)}
                {...subtleButtonTapMotion}
                title="Xem & Sửa Hồ sơ cá nhân"
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-[10px] sm:text-xs font-bold transition-colors cursor-pointer"
              >
                <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                <span className="max-w-[60px] xs:max-w-[80px] sm:max-w-[120px] truncate uppercase tracking-wider">{userLabel}</span>
              </motion.button>

              {/* BUTTON 2: GEAR ICON (OPENS SETTINGS WINDOW) */}
              <motion.button
                onClick={() => setSettingsModalOpen(true)}
                {...iconButtonMotion}
                title="Cài đặt trình phát & giao diện"
                className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-white text-slate-300 hover:text-black border border-white/20 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </motion.button>

              {/* BUTTON 3: SIGN OUT */}
              <motion.button
                onClick={handleLogout}
                {...iconButtonMotion}
                title="Đăng xuất"
                className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-red-900/60 border border-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </motion.button>
            </div>
          ) : (
            <div className="flex items-center">
              <motion.button
                onClick={() => handleOpenAuth()}
                {...buttonTapMotion}
                title="Đăng nhập / Đăng ký"
                className="p-2 rounded-full bg-white text-black hover:bg-slate-200 transition-colors flex items-center justify-center shadow-xl cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          )}
        </div>
      </header>

      {/* MODALS WRAPPED IN ANIMATEPRESENCE FOR SILKY EXIT ANIMATIONS */}
      <AnimatePresence mode="wait">
        {authModalOpen && propOnOpenAuthModal === undefined && (
          <AuthModal
            isOpen={authModalOpen}
            initialTab={authModalTab}
            onClose={() => setAuthModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {profileModalOpen && (
          <ProfileModal
            isOpen={profileModalOpen}
            onClose={() => setProfileModalOpen(false)}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {settingsModalOpen && (
          <SettingsModal
            isOpen={settingsModalOpen}
            onClose={() => setSettingsModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
