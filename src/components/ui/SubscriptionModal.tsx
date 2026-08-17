'use client';

import React, { useState } from 'react';
import {
  Crown,
  Lock,
  Sparkles,
  Film,
  Music,
  Zap,
  CheckCircle,
  ShieldCheck,
  X,
  ExternalLink
} from 'lucide-react';
import { getStoredUserSession, setStoredUserSession } from '@/lib/authSession';

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
        }
      }
      setIsActivating(false);
      setSuccessMsg(true);
      if (onSubscribed) onSubscribed();
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1500);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 pb-28 sm:pb-32 overflow-y-auto bg-black/90 backdrop-blur-xl animate-fadeIn select-none font-mono">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-[#090a0f] border border-white/20 p-5 sm:p-7 shadow-[0_0_80px_rgba(255,255,255,0.08)] overflow-hidden flex flex-col gap-5 text-white animate-scaleUp my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-white/[0.06] blur-3xl pointer-events-none rounded-full" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-400 hover:text-white transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge & Title */}
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

        {/* Features List */}
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

          <div className="flex items-start gap-3 text-xs">
            <Zap className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold text-white">Zero Egress Latency:</span>{' '}
              <span className="text-slate-400">Băng thông ưu tiên tối đa từ hệ thống Edge CDN toàn cầu.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 text-xs">
            <ShieldCheck className="w-4 h-4 text-white mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold text-white">VIP Crown Badge:</span>{' '}
              <span className="text-slate-400">Hiển thị huy hiệu VIP nổi bật trong phần bình luận và hồ sơ.</span>
            </div>
          </div>
        </div>

        {/* Plan Selector */}
        <div className="grid grid-cols-2 gap-3">
          {/* Monthly */}
          <div
            onClick={() => setSelectedPlan('monthly')}
            className={`cursor-pointer rounded-2xl p-3.5 border transition-all flex flex-col gap-1 relative ${
              selectedPlan === 'monthly'
                ? 'bg-white/10 border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            }`}
          >
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">GÓI THÁNG</span>
            <span className="text-base font-black text-white font-cyber">49.000đ<span className="text-[10px] font-normal text-slate-400">/tháng</span></span>
            <span className="text-[9px] text-slate-400">Gia hạn từng tháng linh hoạt</span>
          </div>

          {/* Lifetime */}
          <div
            onClick={() => setSelectedPlan('lifetime')}
            className={`cursor-pointer rounded-2xl p-3.5 border transition-all flex flex-col gap-1 relative ${
              selectedPlan === 'lifetime'
                ? 'bg-white/10 border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-white text-black text-[8px] font-black tracking-wider uppercase">
              BEST VALUE
            </div>
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">TRỌN ĐỜI</span>
            <span className="text-base font-black text-white font-cyber">199.000đ<span className="text-[10px] font-normal text-slate-400">/vĩnh viễn</span></span>
            <span className="text-[9px] text-slate-400">Mở khóa vĩnh viễn toàn bộ kho</span>
          </div>
        </div>

        {/* Action Button */}
        {successMsg ? (
          <div className="w-full py-3 rounded-2xl bg-white text-black font-black text-center flex items-center justify-center gap-2 animate-fadeIn">
            <CheckCircle className="w-5 h-5 text-black" />
            <span className="text-xs uppercase tracking-wider">ĐÃ MỞ KHÓA QUYỀN VIP THÀNH CÔNG!</span>
          </div>
        ) : (
          <button
            onClick={handleQuickActivate}
            disabled={isActivating}
            className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-200 text-black font-black text-xs uppercase tracking-widest transition-all shadow-[0_10px_30px_rgba(255,255,255,0.2)] active:scale-98 flex items-center justify-center gap-2"
          >
            {isActivating ? (
              <span className="animate-pulse">ĐANG KÍCH HOẠT VIP...</span>
            ) : (
              <>
                <Crown className="w-4 h-4 fill-black text-black" />
                <span>KÍCH HOẠT GÓI VIP NGAY</span>
              </>
            )}
          </button>
        )}

        <div className="text-center text-[9px] text-slate-400">
          Tài khoản Admin và Supporter được tự động kích hoạt quyền truy cập video.
        </div>
      </div>
    </div>
  );
}
