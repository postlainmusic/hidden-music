'use client';

import React from 'react';
import { Lock, Sparkles, Film, Disc3, ShieldCheck, Ticket, Play } from 'lucide-react';

interface PaywallOverlayProps {
  onUpgrade: () => void;
  onOpenVoucher?: () => void;
  title?: string;
  artist?: string;
}

export default function PaywallOverlay({
  onUpgrade,
  onOpenVoucher,
  title,
  artist,
}: PaywallOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl select-none animate-fade-in">
      {/* Background Ambience Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-zinc-950/80 to-black/60 pointer-events-none" />

      {/* Cyber Grid & Scanline Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />

      <div className="relative z-10 max-w-lg w-full rounded-2xl bg-zinc-950/90 border border-white/20 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.9)] text-center text-white font-sans flex flex-col items-center">
        {/* Glowing Badge */}
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,255,255,0.15)] relative group">
          <Lock className="w-7 h-7 text-white animate-pulse" />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
            <Sparkles className="w-2 h-2 text-black" />
          </div>
        </div>

        {/* Title */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] text-zinc-300 font-mono uppercase tracking-widest mb-3">
          <Disc3 className="w-3 h-3 text-white animate-spin-slow" />
          <span>POSTLAIN VAULT EXCLUSIVE</span>
        </div>

        <h3 className="text-lg sm:text-2xl font-black uppercase tracking-wider font-cyber mb-1">
          {title ? `MỞ KHÓA MV: ${title}` : 'MỞ KHÓA VIDEO ZONE ĐỘC QUYỀN'}
        </h3>
        {artist && (
          <p className="text-xs text-zinc-400 font-mono uppercase tracking-wider mb-4">
            ARTIST: {artist}
          </p>
        )}

        <p className="text-xs sm:text-sm text-zinc-300 mb-6 leading-relaxed max-w-md">
          Trải nghiệm toàn bộ kho phim ca nhạc 4K HDR, MV Uncensored và các bản ghi hình biểu diễn bí mật từ Hidden Music Vault với độ phân giải siêu nét.
        </p>

        {/* Feature Matrix */}
        <div className="w-full grid grid-cols-2 gap-2.5 mb-6 text-left">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
            <Film className="w-4 h-4 text-white shrink-0" />
            <span className="text-[11px] font-mono text-zinc-300">4K Ultra-HD MV</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
            <Disc3 className="w-4 h-4 text-white shrink-0" />
            <span className="text-[11px] font-mono text-zinc-300">Uncompressed Audio</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
            <Sparkles className="w-4 h-4 text-white shrink-0" />
            <span className="text-[11px] font-mono text-zinc-300">Uncensored Cuts</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
            <ShieldCheck className="w-4 h-4 text-white shrink-0" />
            <span className="text-[11px] font-mono text-zinc-300">Direct CDN Stream</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="w-full flex flex-col sm:flex-row gap-3">
          <button
            onClick={onUpgrade}
            className="flex-1 py-3.5 px-6 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-all duration-200 active:scale-95 shadow-[0_0_25px_rgba(255,255,255,0.25)] flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>MỞ KHÓA TRUY CẬP NGAY</span>
          </button>

          {onOpenVoucher && (
            <button
              onClick={onOpenVoucher}
              className="py-3.5 px-4 rounded-xl bg-white/10 border border-white/20 text-white font-mono text-xs uppercase tracking-wider hover:bg-white/20 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
            >
              <Ticket className="w-4 h-4" />
              <span>VOUCHER PASS</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
