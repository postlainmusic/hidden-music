'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film,
  Sparkles,
  CheckCircle2,
  X,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Disc3,
  Flame,
  ArrowRight,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  CreditCard,
  Ticket,
} from 'lucide-react';
import {
  activateVideoSubscription,
  getStoredUserSession,
  hasVideoSubscription,
  refreshUserProfile,
} from '@/lib/authSession';
import {
  modalBackdropVariants,
  modalContentVariants,
  buttonTapMotion,
  subtleButtonTapMotion,
  iconButtonMotion,
  springSnappy,
  fadeVariants,
} from '@/lib/motionVariants';

interface VideoPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PayOSPaymentState {
  orderCode: number;
  checkoutUrl: string;
  qrCode?: string;
  amount: number;
  accountNumber?: string;
  accountName?: string;
  bin?: string;
  description: string;
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

  // payOS Flow State
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [payOSPayment, setPayOSPayment] = useState<PayOSPaymentState | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-check & auto-unlock if user is already VIP when modal opens
  useEffect(() => {
    if (isOpen) {
      if (hasVideoSubscription()) {
        if (onSuccess) onSuccess();
        onClose();
        return;
      }

      // Query database directly to see if Admin just granted access
      refreshUserProfile().then((fresh) => {
        if (fresh && hasVideoSubscription(fresh)) {
          if (onSuccess) onSuccess();
          onClose();
        }
      });
    }
  }, [isOpen, onClose, onSuccess]);

  // Cleanup polling when modal closes or unmounts
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setPayOSPayment(null);
      setPaymentError(null);
      setPasscodeError(null);
      setActiveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = passcodeInput.trim().toUpperCase();
    if (!code) {
      setPasscodeError('Vui lòng nhập mã Voucher / Passcode.');
      return;
    }

    setIsActivating(true);
    setPasscodeError(null);

    try {
      const session = getStoredUserSession();
      const res = await fetch('/api/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          userId: session?.id,
          email: session?.email,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Activate local subscription and refresh user session
        activateVideoSubscription();
        await refreshUserProfile();
        setActiveSuccess(true);
        setIsActivating(false);

        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
          setActiveSuccess(false);
        }, 900);
      } else {
        throw new Error(data.error || 'Mã kích hoạt không đúng hoặc đã hết hạn.');
      }
    } catch (err: any) {
      console.warn('Voucher submit note:', err);
      setPasscodeError(err.message || 'Mã kích hoạt không đúng hoặc đã hết hạn.');
      setIsActivating(false);
    }
  };

  // Start payOS Payment Creation
  const handleCreatePayOSPayment = async () => {
    setIsCreatingPayment(true);
    setPaymentError(null);

    try {
      const session = getStoredUserSession();
      const res = await fetch('/api/payos/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          userEmail: session?.email,
          userName: session?.display_name,
          userId: session?.id,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Không thể tạo phiên thanh toán payOS.');
      }

      setPayOSPayment({
        orderCode: data.orderCode,
        checkoutUrl: data.checkoutUrl,
        qrCode: data.qrCode,
        amount: data.amount,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        bin: data.bin,
        description: data.description,
      });

      // Start Polling for Payment Success
      startPollingPayment(data.orderCode);
    } catch (err: any) {
      console.error('payOS creation error:', err);
      setPaymentError(err.message || 'Lỗi kết nối cổng thanh toán payOS.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  // Check Payment Status via API
  const checkPaymentStatus = async (orderCode: number) => {
    try {
      setIsCheckingPayment(true);
      const session = getStoredUserSession();
      const query = new URLSearchParams({
        orderCode: String(orderCode),
        email: session?.email || '',
        userId: session?.id || '',
      });

      const res = await fetch(`/api/payos/check-payment?${query.toString()}`);
      const data = await res.json();

      if (data.success && (data.paid || data.status === 'PAID')) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        activateVideoSubscription();
        setActiveSuccess(true);

        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
          setActiveSuccess(false);
        }, 1200);
      }
    } catch (e) {
      console.warn('Polling check error:', e);
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const startPollingPayment = (orderCode: number) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(() => {
      checkPaymentStatus(orderCode);
    }, 2500);
  };

  return (
    <motion.div
      variants={modalBackdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md select-none font-mono"
    >
      <div className="tv-grain-overlay opacity-30 pointer-events-none" />

      {/* Modal Container */}
      <motion.div
        variants={modalContentVariants}
        className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-zinc-900 to-black border border-white/20 p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden text-white max-h-[92vh] overflow-y-auto no-scrollbar"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-white/10 blur-3xl rounded-full pointer-events-none" />

        {/* Close Button */}
        <motion.button
          onClick={onClose}
          {...iconButtonMotion}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors z-20 cursor-pointer"
          title="Đóng cửa sổ"
        >
          <X className="w-4 h-4" />
        </motion.button>

        {/* HEADER SECTION */}
        <div className="flex flex-col items-center text-center">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.05 }}
            transition={springSnappy}
            className="w-14 h-14 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(255,255,255,0.1)] cursor-pointer"
          >
            <Film className="w-7 h-7 text-white" />
          </motion.div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] uppercase font-bold tracking-widest text-slate-300 mb-2">
            <Crown className="w-3 h-3 text-white" />
            <span>VAULT VIDEO PASS // GÓI ĐẶC QUYỀN MV</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black font-cyber uppercase tracking-wider text-white">
            MỞ KHÓA VIDEO ZONE
          </h2>

          <p className="text-xs text-slate-300 max-w-sm mt-1.5 leading-relaxed">
            Nâng cấp gói dịch vụ qua cổng thanh toán tự động <strong>payOS (VietQR)</strong> để truy cập toàn bộ kho MV độc quyền cùng giao diện Theater Mode 2/3.
          </p>
        </div>

        {/* ACTIVE SUCCESS SCREEN */}
        <AnimatePresence mode="wait">
          {activeSuccess ? (
            <motion.div
              key="success-screen"
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="my-8 flex flex-col items-center justify-center text-center space-y-3"
            >
              <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_35px_rgba(255,255,255,0.8)] animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black font-cyber uppercase tracking-wider text-white">
                THANH TOÁN THÀNH CÔNG!
              </h3>
              <p className="text-xs text-slate-300">
                Đặc quyền Video Pass đã được kích hoạt. Đang chuyển hướng vào Video Zone...
              </p>
            </motion.div>
          ) : payOSPayment ? (
            /* PAYOS VIETQR EMBEDDED CHECKOUT SCREEN */
            <motion.div
              key="payos-checkout-screen"
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mt-5 space-y-4"
            >
              <div className="p-4 rounded-2xl bg-zinc-950 border border-white/20 flex flex-col items-center text-center">
                <div className="flex items-center justify-between w-full pb-2 mb-3 border-b border-white/10 text-xs">
                  <span className="text-slate-400 font-bold uppercase">MÃ ĐƠN HÀNG:</span>
                  <span className="font-mono font-black text-white">#{payOSPayment.orderCode}</span>
                </div>

                {/* VietQR / QR Code Display */}
                <div className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-3">
                  {payOSPayment.qrCode ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payOSPayment.qrCode)}`}
                      alt="VietQR Code"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-44 h-44 flex flex-col items-center justify-center text-black text-xs">
                      <QrCode className="w-10 h-10 mb-2" />
                      <span>Mở app ngân hàng quét mã</span>
                    </div>
                  )}
                </div>

                {/* Banking Transfer Details */}
                <div className="w-full space-y-2 text-left text-xs bg-white/5 p-3 rounded-xl border border-white/10 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Số tiền:</span>
                    <span className="font-black text-white text-sm">{payOSPayment.amount.toLocaleString('vi-VN')} đ</span>
                  </div>

                  {payOSPayment.accountNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Số tài khoản:</span>
                      <button
                        onClick={() => copyToClipboard(payOSPayment.accountNumber || '', 'acc')}
                        className="flex items-center gap-1 font-bold text-white hover:underline cursor-pointer"
                      >
                        <span>{payOSPayment.accountNumber}</span>
                        {copiedField === 'acc' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Nội dung CK:</span>
                    <button
                      onClick={() => copyToClipboard(payOSPayment.description, 'desc')}
                      className="flex items-center gap-1 font-bold text-yellow-300 hover:underline cursor-pointer"
                    >
                      <span>{payOSPayment.description}</span>
                      {copiedField === 'desc' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                    </button>
                  </div>
                </div>

                {/* Important Notes & Screenshot Reminder Box */}
                <div className="w-full mt-3 p-3 rounded-xl bg-amber-950/25 border border-amber-500/30 text-left space-y-1.5 font-mono text-[11px] leading-relaxed">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold uppercase tracking-wider text-[10px]">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>HƯỚNG DẪN & LƯU Ý QUAN TRỌNG:</span>
                  </div>
                  <ul className="space-y-1 text-slate-300 text-[10px] pl-1 list-none">
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">1.</span>
                      <span>Quét mã VietQR hoặc copy chính xác <strong>Số tài khoản</strong>, <strong>Số tiền</strong> và <strong>Nội dung chuyển khoản</strong>.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">2.</span>
                      <span className="text-amber-200 font-semibold">📸 <strong>Vui lòng chụp lại ảnh màn hình giao dịch / hóa đơn chuyển khoản</strong> để bảo đảm quyền lợi và đối soát nhanh khi cần.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">3.</span>
                      <span>Hệ thống tự động kích hoạt gói VIP ngay khi giao dịch thành công (thời gian xử lý 5-30 giây).</span>
                    </li>
                  </ul>
                </div>

                {/* Polling indicator */}
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-300">
                  <Disc3 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Hệ thống tự động kích hoạt ngay sau khi chuyển khoản...</span>
                </div>
              </div>

              {/* Direct PayOS Link Button */}
              <div className="flex gap-2">
                <motion.a
                  href={payOSPayment.checkoutUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (payOSPayment.checkoutUrl) {
                      window.open(payOSPayment.checkoutUrl, '_blank', 'noopener,noreferrer');
                      e.preventDefault();
                    }
                  }}
                  {...buttonTapMotion}
                  className="flex-1 py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-black font-cyber text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  <span>MỞ TRANG THANH TOÁN PAYOS</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </motion.a>

                <motion.button
                  onClick={() => checkPaymentStatus(payOSPayment.orderCode)}
                  disabled={isCheckingPayment}
                  {...subtleButtonTapMotion}
                  className="p-3 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 transition-colors flex items-center justify-center cursor-pointer"
                  title="Kiểm tra trạng thái thanh toán ngay"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingPayment ? 'animate-spin' : ''}`} />
                </motion.button>
              </div>

              <button
                onClick={() => setPayOSPayment(null)}
                className="w-full text-center text-xs text-slate-400 hover:text-white py-1 transition-colors cursor-pointer"
              >
                ← Chọn gói khác hoặc hủy giao dịch
              </button>
            </motion.div>
          ) : (
            /* STANDARD PLAN SELECTION SCREEN */
            <motion.div
              key="plan-selection-screen"
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
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
                  <span>Thanh toán tự động qua payOS VietQR / Chuyển khoản 24/7</span>
                </div>
              </div>

              {/* Pricing Cards Selection with Spring Micro-Interactions */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {/* Option 1: Monthly */}
                <motion.div
                  onClick={() => setSelectedPlan('monthly')}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={springSnappy}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-colors flex flex-col justify-between ${
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
                </motion.div>

                {/* Option 2: Lifetime (VIP) */}
                <motion.div
                  onClick={() => setSelectedPlan('lifetime')}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={springSnappy}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-colors flex flex-col justify-between relative overflow-hidden ${
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
                </motion.div>
              </div>

              {paymentError && (
                <p className="mt-3 text-xs text-red-400 font-mono text-center">{paymentError}</p>
              )}

              {/* Primary Action: payOS VietQR Payment */}
              <div className="mt-5 space-y-3">
                <motion.button
                  onClick={handleCreatePayOSPayment}
                  disabled={isCreatingPayment}
                  {...buttonTapMotion}
                  className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-zinc-200 text-black font-black font-cyber text-xs uppercase tracking-widest transition-colors shadow-[0_10px_25px_rgba(255,255,255,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingPayment ? (
                    <>
                      <Disc3 className="w-4 h-4 animate-spin text-black" />
                      <span>ĐANG TẠO MÃ THANH TOÁN PAYOS...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      <span>THANH TOÁN QUA PAYOS / VIETQR</span>
                    </>
                  )}
                </motion.button>

                {/* Voucher / Passcode Activation Form */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-bold">
                    <Ticket className="w-3.5 h-3.5 text-white" />
                    <span>Kích hoạt bằng mã Passcode / Voucher:</span>
                  </div>

                  <form onSubmit={handlePasscodeSubmit} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={passcodeInput}
                      onChange={(e) => setPasscodeInput(e.target.value)}
                      placeholder="Nhập mã voucher (vd: VIP2026)"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white transition-colors font-mono uppercase"
                    />
                    <motion.button
                      type="submit"
                      disabled={isActivating}
                      {...subtleButtonTapMotion}
                      className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-black font-mono transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-md flex-shrink-0 cursor-pointer"
                    >
                      {isActivating ? (
                        <>
                          <Disc3 className="w-3.5 h-3.5 animate-spin text-black" />
                          <span>XỬ LÝ...</span>
                        </>
                      ) : (
                        <span>ÁP DỤNG</span>
                      )}
                    </motion.button>
                  </form>

                  {passcodeError && (
                    <p className="text-[11px] text-rose-400 font-mono text-center">{passcodeError}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </motion.div>
  );
}
