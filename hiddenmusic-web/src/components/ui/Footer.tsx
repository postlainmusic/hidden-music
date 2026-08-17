'use client';

import React from 'react';
import { Terminal, Shield, Disc3 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-white/10 bg-black/40 backdrop-blur-xl py-6 px-4 font-mono text-center text-xs text-slate-500 select-none pb-28 sm:pb-32">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-400">
          <Terminal className="w-4 h-4 text-white" />
          <span>SYSTEM NODE // POSTLAIN.COM</span>
        </div>
        <div>
          <span>© 2026 HIDDEN MUSIC VAULT • ZERO EGRESS STREAMING</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <a href="/admin" className="hover:text-white transition-colors">ADMIN VAULT</a>
          <a href="/terms" className="hover:text-white transition-colors">TERMS</a>
          <a href="/dmca" className="hover:text-white transition-colors">DMCA</a>
        </div>
      </div>
    </footer>
  );
}
