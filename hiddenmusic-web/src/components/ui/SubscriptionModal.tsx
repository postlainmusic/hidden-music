'use client';

import React, { useState } from 'react';
import { Crown, Film, Music, X, CheckCircle, ShieldCheck } from 'lucide-react';
import { getStoredUserSession, setStoredUserSession } from '../../lib/authSession';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribed?: () => void;
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  onSubscribed,
}: SubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'lifetime'>('lifetime');
  const [isActivating, setIsActivating] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  if (!isOpen) return null;

  const handleQuickActivate = () => {
    setIsActivating(true);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('hidden_vault_vip_active', 'true');
        const session = getStoredUserSession();
        if (session) {
          session.is_subscribed = true;
          session.subscription_status = 'active';
          session.subscription_tier = selectedPlan === 'lifetime' ? 'lifetime' : 'vip';
          setStoredUserSession(session);
        } else {
          setStoredUserSession({
            id: 'guest_vip',
            email: 'vip@postlain.com',
            is_subscribed: true,
            subscription_status: 'active',
            subscription_tier: 'lifetime',
          });
        }
      }
      setIsActivating(false);
      setSuccessMsg(true);
      if (onSubscribed) onSubscribed();
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1200);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 pb-28 sm:pb-32 overflow-y-auto bg-black/90 backdrop-blur-xl animate-fadeIn select-none font-mono">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-[#090a0f] border border-white/20 p-5 sm:p-7 shadow-[0_0_80px_rgba(255,255,255,0.08)] overflow-hidden flex flex-col gap-5 text-white animate-scaleUp my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-400 hover:text-white transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-2 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/25 text-[10px] sm:text-xs font-bold tracking-widest text-white uppercase shadow-inner">
            <Crown className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>VIP EXCLUSIVE ACCESS</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black font-cyber tracking-wider text-white uppercase mt-1">
            MỞ KHÓA KHO VIDEO MV
          </h2>
          <p className="text-xs text-slate-400 max-w-sm">
            Toàn bộ video âm nhạc (MV), visualizers và tư liệu bị ẩn độc quyền được lưu trữ riêng cho thành viên VIP Subscription.
          </p>
        </div>

        <div className="space-y-2.5 bg-white/[0.03] border border-white/10 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-start gap-3 text-xs">
            <Film className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold text-white">Full HD / 4K Video MVs:</span>{' '}
              <span className="text-slate-400">Xem trực tiếp kho MV unreleased độc quyền, không chèn quảng cáo.</span>
            </div>
          </div>
          <div className="flex items-start gap-3 text-xs">
            <Music className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold text-white">Audio Lossless Master:</span>{' '}
              <span className="text-slate-400">Stream âm thanh 24-bit 96kHz FLAC không nén từ Cloudflare R2.</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedPlan('monthly')}
            className={`p-3.5 rounded-2xl border text-left transition-all relative ${
              selectedPlan === 'monthly'
                ? 'bg-white/15 border-white shadow-md text-white'
                : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-slate-400">GÓI THÁNG</span>
            <div className="text-base sm:text-lg font-black text-white mt-0.5">49.000đ<span className="text-xs font-normal text-slate-400">/tháng</span></div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan('lifetime')}
            className={`p-3.5 rounded-2xl border text-left transition-all relative ${
              selectedPlan === 'lifetime'
                ? 'bg-white/15 border-white shadow-md text-white'
                : 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-white/20'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-slate-400">TRỌN ĐỜI</span>
            <div className="text-base sm:text-lg font-black text-white mt-0.5">199.000đ<span className="text-xs font-normal text-slate-400">/vĩnh viễn</span></div>
          </button>
        </div>

        <button
          onClick={handleQuickActivate}
          disabled={isActivating || successMsg}
          className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-200 text-black font-black font-cyber text-xs uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-2"
        >
          {successMsg ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>ĐÃ KÍCH HOẠT VIP THÀNH CÔNG!</span>
            </>
          ) : isActivating ? (
            <span>ĐANG XỬ LÝ...</span>
          ) : (
            <>
              <Crown className="w-4 h-4 fill-current" />
              <span>KÍCH HOẠT VIP NGAY BÂY GIỜ</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
