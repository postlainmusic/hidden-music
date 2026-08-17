'use client';

import React, { useState, useEffect } from 'react';
import { Disc3, Search, User, ShieldCheck, LogIn, Crown } from 'lucide-react';
import { getStoredUserSession, isVipSubscribed } from '../../lib/authSession';
import { UserSession } from '../../types/database';

interface NavbarProps {
  onOpenSearch?: () => void;
  onOpenVIP?: () => void;
}

export default function Navbar({ onOpenSearch, onOpenVIP }: NavbarProps) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    const check = () => {
      setSession(getStoredUserSession());
      setIsVip(isVipSubscribed());
    };
    check();
    window.addEventListener('vault_auth_change', check);
    return () => window.removeEventListener('vault_auth_change', check);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-6 py-3 select-none font-mono">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <a href="/" className="flex items-center gap-2.5 text-white hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-md">
            <Disc3 className="w-4 h-4 animate-spin-slow" />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-xs sm:text-sm font-black font-cyber tracking-widest uppercase">
              HIDDEN MUSIC
            </span>
            <span className="text-[8px] text-slate-400 uppercase tracking-wider">
              UNDERGROUND VAULT
            </span>
          </div>
        </a>

        {/* Center: Search Trigger Button */}
        <div className="flex-1 max-w-sm mx-auto">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-black/60 hover:bg-white/10 border border-white/15 hover:border-white/30 text-slate-400 hover:text-white transition-all text-xs shadow-md backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span className="truncate">Tìm kiếm Vault / YouTube...</span>
            </div>
            <kbd className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-bold border border-white/15">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: VIP Badge & Profile / Login */}
        <div className="flex items-center gap-2">
          {/* VIP Pass Button */}
          <button
            onClick={onOpenVIP}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shadow-md border ${
              isVip
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                : 'bg-white text-black hover:bg-slate-200 border-white active:scale-95'
            }`}
          >
            <Crown className="w-3 h-3" />
            <span>{isVip ? 'VIP ACTIVE' : 'NÂNG CẤP VIP'}</span>
          </button>

          {/* User Profile / Admin link */}
          {session ? (
            <a
              href="/profile"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all shadow-md"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{session.user_metadata?.username || 'HỒ SƠ'}</span>
            </a>
          ) : (
            <a
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all shadow-md"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ĐĂNG NHẬP</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
