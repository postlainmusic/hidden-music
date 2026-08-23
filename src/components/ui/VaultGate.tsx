'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Disc3, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { setStoredAdminSession, setStoredUserSession } from '@/lib/authSession';
import {
  modalContentVariants,
  accordionVariants,
  buttonTapMotion,
  subtleButtonTapMotion,
  springSnappy,
} from '@/lib/motionVariants';

export default function VaultGate() {
  const [showAdminPasskey, setShowAdminPasskey] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const authErr = params.get('auth_error');
      if (authErr) {
        setMsg({
          type: 'error',
          text: authErr === 'true'
            ? 'Xác thực Google thất bại. Vui lòng thử lại.'
            : decodeURIComponent(authErr),
        });
      }
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const redirectUrl = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Lỗi kết nối xác thực Google!';
      setMsg({ type: 'error', text: errorText });
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    let loginEmail = email.trim();
    if (loginEmail.toLowerCase() === 'admin') {
      loginEmail = 'admin@hiddenvault.com';
    }

    if (
      (loginEmail === 'admin@hiddenvault.com' || loginEmail.toLowerCase() === 'admin') &&
      password === 'Lucii@1108'
    ) {
      setStoredAdminSession(true);
      setMsg({ type: 'success', text: 'Xác thực Admin thành công! Đang chuyển hướng...' });
      setTimeout(() => {
        window.location.href = '/admin';
      }, 600);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) throw error;

      if (data?.user) {
        setStoredUserSession(data.user);
      }

      setMsg({
        type: 'success',
        text: 'Đăng nhập thành công! Đang mở Vault...',
      });

      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Tài khoản hoặc mật khẩu không chính xác!';
      setMsg({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 select-none font-mono text-white">
      {/* Background Micro Grain & Scanlines */}
      <div className="tv-grain-overlay" />
      <div className="crt-scanlines" />

      {/* Main Glassmorphic Gate Card with Spring Physics Entrance */}
      <motion.div
        variants={modalContentVariants}
        initial="hidden"
        animate="visible"
        className="bw-panel w-full max-w-md rounded-3xl p-6 sm:p-8 border border-white/30 shadow-[0_0_50px_rgba(255,255,255,0.1)] relative z-10 space-y-6 text-center"
      >
        {/* Logo & Header */}
        <div className="flex flex-col items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 15 }}
            transition={springSnappy}
            className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-xl cursor-pointer"
          >
            <Disc3 className="w-9 h-9 text-white animate-spin-slow" />
          </motion.div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-widest font-cyber uppercase">
              HIDDEN MUSIC
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">
              SECURE VAULT ACCESS GATE
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-300 leading-relaxed font-sans px-2">
          Vui lòng đăng nhập bằng tài khoản Google để giải mã và truy cập toàn bộ kho âm nhạc bí mật.
        </p>

        {/* Status Message with Smooth Alert Reveal */}
        <AnimatePresence mode="wait">
          {msg && (
            <motion.div
              key={msg.text}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={springSnappy}
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 text-left ${
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Sign In Button with Tactile Tap Feedback */}
        <motion.button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          {...buttonTapMotion}
          className="w-full py-4 px-4 rounded-2xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs uppercase tracking-wider shadow-2xl transition-colors flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'ĐANG KẾT NỐI GOOGLE...' : 'ĐĂNG NHẬP BẰNG GOOGLE'}</span>
        </motion.button>

        {/* Admin Passkey Section with Smooth Accordion Expansion */}
        <div className="border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => setShowAdminPasskey(!showAdminPasskey)}
            className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer py-1"
          >
            <span className="flex items-center gap-1.5 font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Passkey Access</span>
            </span>
            {showAdminPasskey ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <AnimatePresence>
            {showAdminPasskey && (
              <motion.form
                variants={accordionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onSubmit={handleAdminSubmit}
                className="space-y-3 mt-3 text-xs text-left overflow-hidden"
              >
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Admin or Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 pl-9 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white transition-colors"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="Password / Passkey"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 pl-9 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white transition-colors"
                    />
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  {...subtleButtonTapMotion}
                  className="w-full py-3 rounded-xl bg-white/20 hover:bg-white text-white hover:text-black font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                >
                  ADMIN LOGIN
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

      </motion.div>
    </div>
  );
}
