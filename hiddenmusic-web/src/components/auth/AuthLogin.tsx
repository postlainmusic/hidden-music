'use client';

import React, { useState } from 'react';
import { LogIn, Key, Mail, Disc3, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { setStoredUserSession } from '../../lib/authSession';

export default function AuthLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.session) {
        setStoredUserSession({
          id: data.session.user.id,
          email: data.session.user.email || email,
          user_metadata: data.session.user.user_metadata,
          is_subscribed: Boolean(data.session.user.user_metadata?.is_subscribed),
        });
        window.location.href = '/';
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng nhập thất bại, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-mono select-none">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-black/70 border border-white/15 backdrop-blur-2xl shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-md">
            <Disc3 className="w-6 h-6 animate-spin-slow" />
          </div>
          <h1 className="text-xl font-black font-cyber text-white uppercase tracking-wider mt-2">
            ĐĂNG NHẬP VAULT
          </h1>
          <p className="text-xs text-slate-400">Truy cập toàn bộ danh mục âm nhạc bị ẩn độc quyền</p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Email</label>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5">
              <Mail className="w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-transparent text-white text-xs outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Mật khẩu</label>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5">
              <Key className="w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-white text-xs outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-200 text-black font-black font-cyber text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl mt-4"
          >
            <span>{loading ? 'ĐANG XÁC THỰC...' : 'TIẾP TỤC'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-white/10">
          Chưa có tài khoản?{' '}
          <a href="/register" className="text-white font-bold hover:underline">
            Đăng ký ngay
          </a>
        </div>
      </div>
    </div>
  );
}
