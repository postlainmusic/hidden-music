'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: 'login' | 'register';
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [showAdminPasskey, setShowAdminPasskey] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const authErr = params.get('auth_error');
      if (authErr) {
        setMsg({
          type: 'error',
          text: authErr === 'true'
            ? 'Xác thực Google thất bại. Vui lòng kiểm tra Client ID & Client Secret trong Supabase Dashboard.'
            : decodeURIComponent(authErr),
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      const errorText = err instanceof Error ? err.message : 'Google authentication failed!';
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
      setMsg({ type: 'success', text: 'Admin passkey verified! Redirecting...' });
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
        text: 'Signed in successfully! Reloading vault...',
      });

      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Authentication system error!';
      setMsg({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none font-mono">
      <div className="bw-panel w-full max-w-md rounded-3xl p-6 border border-white/30 shadow-2xl relative space-y-5">
        {/* Header & Close Button */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-white" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-cyber">
              VAULT AUTHENTICATION
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Message */}
        {msg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              msg.type === 'success'
                ? 'bg-white/15 border border-white/40 text-white'
                : 'bg-red-950/60 border border-red-500/40 text-red-300'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Main Action: Continue with Google */}
        <div className="space-y-3 py-2 text-center">
          <p className="text-xs text-slate-300 leading-relaxed">
            Đăng nhập hoặc đăng ký tài khoản Hidden Music bằng Google Account của bạn.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
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
            <span>{loading ? 'ĐANG KẾT NỐI GOOGLE...' : 'SIGN IN / REGISTER WITH GOOGLE'}</span>
          </button>
        </div>

        {/* Optional Collapsible Admin Master Passkey Access */}
        <div className="border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => setShowAdminPasskey(!showAdminPasskey)}
            className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-white transition-colors"
          >
            <span>Admin Master Passkey Access</span>
            {showAdminPasskey ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdminPasskey && (
            <form onSubmit={handleAdminSubmit} className="space-y-3 mt-3 text-xs">
              <div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Admin or Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pl-8 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pl-8 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-xl bg-white/20 hover:bg-white text-white hover:text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              >
                ADMIN SIGN IN
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
