'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Lock, Cpu, Radio, FileText, Scale } from 'lucide-react';

interface FooterProps {
  isFixed?: boolean;
}

export default function Footer({ isFixed = false }: FooterProps) {
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const footerClass = isFixed
    ? 'fixed bottom-0 left-0 right-0 z-20 pointer-events-auto bg-black/90 border-t border-white/10 px-4 md:px-8 py-2.5 text-white font-mono text-[10px] select-none backdrop-blur-md w-full'
    : 'relative w-full z-20 pointer-events-auto bg-black border-t border-white/10 px-4 md:px-8 py-3.5 text-white font-mono text-[10px] select-none mt-auto';

  return (
    <footer className={footerClass}>
      <div className="w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Left: Futuristic System Node Status */}
        <div className="flex items-center gap-3 text-slate-400">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="uppercase tracking-widest text-[9px]">SYSTEM NODE: ONLINE</span>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-white" /> ENCRYPTION: AES-256
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-white" /> PROTOCOL: VAULT-v2.4
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3 text-white" /> {utcTime}
            </span>
          </div>
        </div>

        {/* Center: Copyright & Restricted Vault Notice */}
        <div className="text-slate-400 tracking-widest text-center text-[9px] uppercase">
          © {new Date().getFullYear()} HIDDEN MUSIC VAULT <span className="text-slate-600">// RESTRICTED ARCHIVE</span>
        </div>

        {/* Right: Standard Essential Terms & Legal Links */}
        <div className="flex items-center gap-3 text-slate-400">
          <Link
            href="/legal"
            className="hover:text-white transition-colors flex items-center gap-1 uppercase"
          >
            <FileText className="w-3 h-3 text-white" /> Terms of Service
          </Link>
          <span className="text-white/20">•</span>
          <Link
            href="/legal"
            className="hover:text-white transition-colors flex items-center gap-1 uppercase"
          >
            <Shield className="w-3 h-3 text-white" /> Privacy Policy
          </Link>
          <span className="text-white/20">•</span>
          <Link
            href="/legal"
            className="hover:text-white transition-colors flex items-center gap-1 uppercase"
          >
            <Scale className="w-3 h-3 text-white" /> DMCA Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
