'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Zap } from 'lucide-react';
import MediaMetadataScanner from '@/components/ui/MediaMetadataScanner';

export default function MetadataPage() {
  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 font-cyber relative">
      <div className="tv-grain-overlay" />

      {/* Header */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-white/20 relative z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-white text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white uppercase tracking-widest font-mono flex items-center gap-2">
              <Zap className="w-6 h-6 text-white" /> ĐỌC METADATA MEDIA THẦN TỐC
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Phân tích định dạng tệp âm thanh/video, đọc ID3/Container tags & xuất file (.json, .txt, .csv)
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-white" />
          <span>TOOL METADATA</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <MediaMetadataScanner />
      </div>
    </main>
  );
}
