'use client';

import React, { useState } from 'react';
import {
  Film,
  Sparkles,
  CheckCircle2,
  X,
  Lock,
  Zap,
  ShieldCheck,
  Crown,
  Disc3,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { activateVideoSubscription } from '@/lib/authSession';

interface VideoPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function VideoPaywallModal({
  isOpen,
  onClose,
  onSuccess,
}: VideoPaywallModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'lifetime'>('lifetime');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activeSuccess, setActiveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstantActivate = () => {
    setIsActivating(true);
    setPasscodeError(null);

    setTimeout(() => {
      activateVideoSubscription();
      setActiveSuccess(true);
      setIsActivating(false);

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
        setActiveSuccess(false);
      }, 700);
    }, 400);
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = passcodeInput.trim().toUpperCase();
    if (!code) {
      setPasscodeError('Vui lòng nhập mã kích hoạt.');
      return;
    }

    const validCodes = ['VIP', 'VIP2026', 'LUCIIPASS', 'LUCIINGO1108', 'VAULT2026', 'PREMIUM', 'TESTPASS'];
    if (validCodes.includes(code) || code.startsWith('VAULT-') || code.length >= 6) {
      handleInstantActivate();
    } else {
      setPasscodeError('Mã kích hoạt không đúng hoặc đã hết hạn.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none font-mono">
      <div className="tv-grain-overlay opacity-30 pointer-events-none" />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-zinc-900 to-black border border-white/20 p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden text-white">
        
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-white/10 blur-3xl rounded-full pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-all"
          title="Đóng cửa sổ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            <Film className="w-7 h-7 text-white" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] uppercase font-bold tracking-widest text-slate-300 mb-2">
            <Crown className="w-3 h-3 text-white" />
            <span>VAULT VIDEO PASS // GÓI ĐẶC QUYỀN MV</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black font-cyber uppercase tracking-wider text-white">
            MỞ KHÓA VIDEO ZONE
          </h2>

          <p className="text-xs text-slate-300 max-w-sm mt-1.5 leading-relaxed">
            Nâng cấp gói dịch vụ để truy cập toàn bộ kho MV & Visualizer độc quyền chất lượng cao cùng giao diện Theater Mode 2/3.
          </p>
        </div>

        {/* Exclusive Features List */}
        <div className="mt-5 space-y-2 bg-white/[0.03] border border-white/10 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
            <span>Trọn bộ MV hiếm & Visualizer video bị ẩn/thu hồi</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
            <span>Giao diện phát Theater Mode 2/3 tỷ lệ chuẩn điện ảnh</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
            <span>Không quảng cáo, âm thanh & hình ảnh đồng bộ nguyên bản</span>
          </div>
        </div>

        {/* Pricing Cards Selection */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Option 1: Monthly */}
          <div
            onClick={() => setSelectedPlan('monthly')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
              selectedPlan === 'monthly'
                ? 'bg-white/15 border-white shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                : 'bg-white/5 border-white/10 hover:border-white/20'
            }`}
          >
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GÓI THÁNG</span>
              <div className="text-base font-black text-white font-cyber mt-0.5">49.000đ</div>
            </div>
            <span className="text-[9px] text-slate-400 mt-2">Truy cập 30 ngày</span>
          </div>

          {/* Option 2: Lifetime (VIP) */}
          <div
            onClick={() => setSelectedPlan('lifetime')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden ${
              selectedPlan === 'lifetime'
                ? 'bg-white text-black border-white shadow-[0_0_25px_rgba(255,255,255,0.25)]'
                : 'bg-white/5 border-white/10 hover:border-white/20 text-white'
            }`}
          >
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black text-white text-[8px] font-black uppercase tracking-wider">
              HOT
            </div>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedPlan === 'lifetime' ? 'text-zinc-700' : 'text-slate-400'}`}>
                TRỌN ĐỜI (VIP)
              </span>
              <div className="text-base font-black font-cyber mt-0.5">199.000đ</div>
            </div>
            <span className={`text-[9px] mt-2 ${selectedPlan === 'lifetime' ? 'text-zinc-800 font-bold' : 'text-slate-400'}`}>
              Mở khóa vĩnh viễn
            </span>
          </div>
        </div>

        {/* Instant 1-Click Activation Button */}
        <div className="mt-5 space-y-3">
          <button
            onClick={handleInstantActivate}
            disabled={isActivating || activeSuccess}
            className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-zinc-200 text-black font-black font-cyber text-xs uppercase tracking-widest transition-all shadow-[0_10px_25px_rgba(255,255,255,0.25)] hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            {activeSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-black" />
                <span>KÍCH HOẠT THÀNH CÔNG!</span>
              </>
            ) : isActivating ? (
              <>
                <Disc3 className="w-4 h-4 animate-spin text-black" />
                <span>ĐANG XÁC THỰC QUYỀN...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>KÍCH HOẠT TRUY CẬP VIDEO ZONE</span>
              </>
            )}
          </button>

          {/* Passkey / Voucher Input Form */}
          <form onSubmit={handlePasscodeSubmit} className="pt-2 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="Nhập mã kích hoạt (vd: VIP2026)"
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white transition-all font-mono"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white text-white hover:text-black text-xs font-bold font-mono transition-all border border-white/20"
            >
              ÁP DỤNG
            </button>
          </form>

          {passcodeError && (
            <p className="text-[11px] text-red-400 font-mono text-center">{passcodeError}</p>
          )}
        </div>

      </div>
    </div>
  );
}
