'use client';

export const runtime = 'edge';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Lock, Mail, User, Disc3, AlertCircle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) throw error;

      setSuccessMsg('Đăng ký tài khoản thành công! Đang chuyển hướng...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Đã xảy ra lỗi khi tạo tài khoản.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối Google Auth.';
      setErrorMsg(message);
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full bg-black text-white flex items-center justify-center p-4 overflow-hidden font-cyber select-none">
      <div className="tv-grain-overlay" />
      <div className="crt-scanlines" />

      <div className="relative w-full max-w-md bw-panel rounded-3xl p-8 border border-white/20 shadow-2xl z-10 animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="w-12 h-12 rounded-2xl bg-white p-[1px] shadow-lg group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-black rounded-[15px] flex items-center justify-center">
                <Disc3 className="w-6 h-6 text-white animate-spin-slow" />
              </div>
            </div>
          </Link>
          <h2 className="text-2xl font-extrabold tracking-widest font-cyber uppercase text-white">
            TẠO TÀI KHOẢN VAULT
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">Đăng ký thành viên bằng Google Account</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-white/15 border border-white/40 text-white text-xs flex items-center gap-2 font-mono">
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-white" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Primary Google Auth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3.5 px-4 mb-6 rounded-2xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs uppercase tracking-wider shadow-xl transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 font-mono"
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
          <span>{loading ? 'ĐANG KẾT NỐI GOOGLE...' : 'ĐĂNG KÝ BẰNG GOOGLE'}</span>
        </button>

        <form onSubmit={handleRegister} className="space-y-5 font-mono text-xs">
          <div>
            <label className="block uppercase text-slate-400 mb-2">
              Tên hiển thị / Biệt danh
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="Agent 007"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block uppercase text-slate-400 mb-2">
              Email đăng ký
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block uppercase text-slate-400 mb-2">
              Mật khẩu (tối thiểu 6 ký tự)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:bg-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">ĐANG TẠO TÀI KHOẢN...</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>ĐĂNG KÝ NGAY</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-400 border-t border-slate-800 pt-6 font-mono">
          Đã có tài khoản?{' '}
          <Link href="/login" className="text-white font-bold hover:underline">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </main>
  );
}
