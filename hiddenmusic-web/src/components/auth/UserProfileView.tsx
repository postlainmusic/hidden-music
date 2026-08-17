'use client';

import React, { useState, useEffect } from 'react';
import { User, Crown, LogOut, ShieldCheck, Mail, Calendar, Key } from 'lucide-react';
import { getStoredUserSession, setStoredUserSession, isVipSubscribed } from '../../lib/authSession';
import { UserSession } from '../../types/database';
import { supabase } from '../../lib/supabase';
import SubscriptionModal from '../ui/SubscriptionModal';

export default function UserProfileView() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);

  useEffect(() => {
    setSession(getStoredUserSession());
    setIsVip(isVipSubscribed());
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setStoredUserSession(null);
    window.location.href = '/';
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 font-mono select-none">
        <p className="text-slate-400 mb-4 text-xs">Bạn chưa đăng nhập vào hệ thống.</p>
        <a href="/login" className="px-6 py-2.5 rounded-2xl bg-white text-black font-bold text-xs uppercase tracking-wider">
          ĐĂNG NHẬP NGAY
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-32 px-4 sm:px-8 font-mono select-none max-w-2xl mx-auto flex items-center justify-center">
      <div className="w-full rounded-3xl bg-black/70 border border-white/15 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-xl font-bold shadow-md">
            {session.user_metadata?.username?.[0]?.toUpperCase() || session.email[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black font-cyber text-white uppercase">
                {session.user_metadata?.username || 'THÀNH VIÊN VAULT'}
              </h1>
              {isVip && (
                <span className="text-[8px] px-2 py-0.5 rounded-full font-black uppercase bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> VIP
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{session.email}</p>
          </div>
        </div>

        {/* Thông tin gói VIP */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">TRẠNG THÁI TÀI KHOẢN</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isVip ? 'Bạn đã kích hoạt gói VIP Subscription (Mở khóa toàn bộ MV & Lossless).' : 'Tài khoản Tiêu chuẩn (Chỉ nghe Audio thông thường).'}
            </p>
          </div>
          {!isVip && (
            <button
              onClick={() => setIsVipModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-black text-xs font-black uppercase tracking-wider flex-shrink-0"
            >
              NÂNG CẤP
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="pt-2 flex items-center justify-between">
          <a href="/admin" className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors">
            <ShieldCheck className="w-4 h-4" /> TRANG QUẢN TRỊ
          </a>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-950/80 text-red-300 border border-red-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> ĐĂNG XUẤT
          </button>
        </div>
      </div>

      <SubscriptionModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        onSubscribed={() => setIsVip(true)}
      />
    </div>
  );
}
