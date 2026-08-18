'use client';

import React, { useState } from 'react';
import { Shield, FileText, Scale } from 'lucide-react';
import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'dmca'>('terms');

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 pt-20 md:pt-24 font-cyber relative overflow-x-hidden select-none pb-28 flex flex-col justify-between">
      {/* Top Header */}
      <Navbar showBackButton={true} />

      {/* Analog TV Grain Noise & CRT Scanlines Overlays */}
      <div className="tv-grain-overlay" />
      <div className="crt-scanlines" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10 font-mono text-xs w-full mb-12">
        {/* Legal Tabs */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 rounded-2xl bg-black border border-white/20 text-[11px] sm:text-xs font-mono">
          <button
            onClick={() => setActiveTab('terms')}
            className={`py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 font-extrabold uppercase transition-all ${
              activeTab === 'terms' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">1. Terms of Service</span>
            <span className="sm:hidden">Terms</span>
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 font-extrabold uppercase transition-all ${
              activeTab === 'privacy' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">2. Privacy Policy</span>
            <span className="sm:hidden">Privacy</span>
          </button>
          <button
            onClick={() => setActiveTab('dmca')}
            className={`py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 font-extrabold uppercase transition-all ${
              activeTab === 'dmca' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">3. DMCA Policy</span>
            <span className="sm:hidden">DMCA</span>
          </button>
        </div>

        {/* Content Box */}
        <div className="bw-panel rounded-3xl p-6 md:p-8 border border-white/20 space-y-6">
          {activeTab === 'terms' && (
            <div className="space-y-4 text-slate-300 leading-relaxed">
              <h2 className="text-lg font-bold text-white uppercase flex items-center gap-2 font-cyber border-b border-white/10 pb-3">
                <FileText className="w-5 h-5 text-white" />
                TERMS OF SERVICE
              </h2>
              <p>
                Welcome to <strong>Hidden Music Vault</strong>. By accessing and using this service, you agree to comply with our restricted encryption and vault usage policies.
              </p>
              <h3 className="font-bold text-white uppercase text-sm mt-4">1. Vault Access Rights</h3>
              <p>
                All unreleased audio recordings, music videos, and album archives hosted within Hidden Music Vault are stored exclusively for archiving and vault streaming experiences. Redistribution, unauthorized copying, or commercial exploitation is strictly prohibited.
              </p>
              <h3 className="font-bold text-white uppercase text-sm mt-4">2. Account Responsibility</h3>
              <p>
                Users are responsible for maintaining the confidentiality of their credentials. Any unauthorized access attempts or security breaches will result in immediate vault termination.
              </p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4 text-slate-300 leading-relaxed">
              <h2 className="text-lg font-bold text-white uppercase flex items-center gap-2 font-cyber border-b border-white/10 pb-3">
                <Shield className="w-5 h-5 text-white" />
                PRIVACY POLICY
              </h2>
              <p>
                Hidden Music Vault respects your privacy. We are committed to protecting all user data using zero-knowledge standards.
              </p>
              <h3 className="font-bold text-white uppercase text-sm mt-4">1. Data Collection</h3>
              <p>
                We only collect minimal email credentials required for authentication to unlock restricted album archives.
              </p>
              <h3 className="font-bold text-white uppercase text-sm mt-4">2. AES-256 Vault Encryption</h3>
              <p>
                All user accounts and access logs are protected using end-to-end AES-256 encryption on Supabase Auth & PostgreSQL databases.
              </p>
            </div>
          )}

          {activeTab === 'dmca' && (
            <div className="space-y-4 text-slate-300 leading-relaxed">
              <h2 className="text-lg font-bold text-white uppercase flex items-center gap-2 font-cyber border-b border-white/10 pb-3">
                <Scale className="w-5 h-5 text-white" />
                DMCA & COPYRIGHT POLICY
              </h2>
              <p>
                Hidden Music Vault strictly respects digital copyright ownership and Digital Millennium Copyright Act (DMCA) regulations.
              </p>
              <h3 className="font-bold text-white uppercase text-sm mt-4">1. Copyright Infringement Notices</h3>
              <p>
                If you are the copyright holder or authorized representative of any archived audio or video content and wish to request removal, please submit a formal takedown notice to our vault administrators.
              </p>
              <h3 className="font-bold text-white uppercase text-sm mt-4">2. Takedown Protocol</h3>
              <p>
                Upon receipt of a valid copyright notice, our team will review and remove the requested content from public vault access within 24 hours.
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer isFixed={false} />
    </main>
  );
}
