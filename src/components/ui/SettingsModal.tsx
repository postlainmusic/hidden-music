'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Volume2,
  Tv,
  CheckCircle,
  AlertCircle,
  Save,
  ArrowLeft,
  Shield,
  ExternalLink
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';
import Link from 'next/link';
import {
  modalBackdropVariants,
  modalContentVariants,
  buttonTapMotion,
  subtleButtonTapMotion,
  iconButtonMotion,
  springSnappy,
} from '@/lib/motionVariants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Settings states stored in localStorage
  const [crtEffect, setCrtEffect] = useState(true);
  const [audioQuality, setAudioQuality] = useState<'hifi' | 'standard'>('hifi');
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    // Load sessionStorage preferences
    const storedCrt = sessionStorage.getItem('hv_crt_effect');
    if (storedCrt !== null) setCrtEffect(storedCrt === 'true');

    const storedQuality = sessionStorage.getItem('hv_audio_quality');
    if (storedQuality) setAudioQuality(storedQuality as 'hifi' | 'standard');

    const storedAutoPlay = sessionStorage.getItem('hv_autoplay');
    if (storedAutoPlay !== null) setAutoPlay(storedAutoPlay === 'true');

    const checkAdmin = async () => {
      try {
        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();
          if (dbProfile) setProfile(dbProfile);
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkAdmin();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    // Save preferences to sessionStorage
    sessionStorage.setItem('hv_crt_effect', crtEffect.toString());
    sessionStorage.setItem('hv_audio_quality', audioQuality);
    sessionStorage.setItem('hv_autoplay', autoPlay.toString());

    // Toggle CRT overlay class on body live
    const crtEl = document.querySelector('.crt-scanlines') as HTMLElement | null;
    const grainEl = document.querySelector('.tv-grain-overlay') as HTMLElement | null;
    if (crtEl) crtEl.style.display = crtEffect ? 'block' : 'none';
    if (grainEl) grainEl.style.display = crtEffect ? 'block' : 'none';

    setMsg({ type: 'success', text: 'Đã lưu tùy chỉnh Cài đặt!' });
    setTimeout(() => {
      setSaving(false);
      onClose();
    }, 600);
  };

  const isUserAdmin = profile?.role === 'admin' || user?.email === 'admin@hiddenvault.com';

  return (
    <motion.div
      variants={modalBackdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-3 sm:p-4 select-none font-mono text-white"
    >
      <motion.div
        variants={modalContentVariants}
        className="bw-panel w-full max-w-md rounded-3xl p-5 sm:p-7 border border-white/30 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto font-mono"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-cyber">
                CÀI ĐẶT TRÌNH PHÁT
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Tùy chỉnh âm thanh & hiệu ứng thị giác</p>
            </div>
          </div>

          <motion.button
            onClick={onClose}
            {...subtleButtonTapMotion}
            title="Đóng"
            className="p-2 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors flex items-center gap-1 text-xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline font-bold">TRỞ LẠI</span>
          </motion.button>
        </div>

        {/* Message Status */}
        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={springSnappy}
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
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

        <form onSubmit={handleSave} className="space-y-5 text-xs">
          
          {/* Audio & Vault Experience Preferences */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              <span>VAULT PLAYBACK PREFERENCES</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Quality Option */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[11px] text-slate-300 font-bold block">Chất lượng Âm thanh</span>
                <select
                  value={audioQuality}
                  onChange={(e) => setAudioQuality(e.target.value as 'hifi' | 'standard')}
                  className="w-full bg-black border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="hifi">HI-FI LOSSLESS (320kbps)</option>
                  <option value="standard">STANDARD (192kbps)</option>
                </select>
              </div>

              {/* Autoplay Option with Animated Toggle Switch */}
              <div
                onClick={() => setAutoPlay(!autoPlay)}
                className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="text-[11px] text-slate-300 font-bold block">Tự động phát</span>
                  <span className="text-[10px] text-slate-500">Bài tiếp theo</span>
                </div>
                <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${autoPlay ? 'bg-white' : 'bg-white/20'}`}>
                  <motion.div
                    layout
                    transition={springSnappy}
                    className={`w-4 h-4 rounded-full shadow-md ${autoPlay ? 'bg-black ml-auto' : 'bg-white mr-auto'}`}
                  />
                </div>
              </div>
            </div>

            {/* CRT Scanline Visual Toggle with Animated Switch */}
            <div
              onClick={() => setCrtEffect(!crtEffect)}
              className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-white" />
                <div>
                  <span className="text-[11px] text-slate-300 font-bold block">Hiệu ứng CRT Scanline & TV Grain</span>
                  <span className="text-[10px] text-slate-500">Hiệu ứng nhiễu TV cổ điển</span>
                </div>
              </div>
              <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${crtEffect ? 'bg-white' : 'bg-white/20'}`}>
                <motion.div
                  layout
                  transition={springSnappy}
                  className={`w-4 h-4 rounded-full shadow-md ${crtEffect ? 'bg-black ml-auto' : 'bg-white mr-auto'}`}
                />
              </div>
            </div>
          </div>

          {/* Admin Quick Portal Access */}
          {isUserAdmin && (
            <div className="p-3 rounded-xl bg-white/10 border border-white/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-white" />
                <div>
                  <span className="text-xs font-bold text-white uppercase font-cyber">ADMIN PORTAL</span>
                  <span className="text-[10px] text-slate-400 block">Quản lý kho nhạc bí mật</span>
                </div>
              </div>
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-lg bg-white text-black font-extrabold text-[11px] uppercase tracking-wider hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>OPEN PORTAL</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <motion.button
              type="submit"
              disabled={saving}
              {...buttonTapMotion}
              className="w-full py-3.5 rounded-2xl bg-white hover:bg-slate-200 text-black font-extrabold text-xs uppercase tracking-wider shadow-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'ĐANG LƯU CÀI ĐẶT...' : 'LƯU CÀI ĐẶT'}</span>
            </motion.button>

            <motion.button
              type="button"
              onClick={onClose}
              {...subtleButtonTapMotion}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>TRỞ LẠI</span>
            </motion.button>
          </div>

        </form>

      </motion.div>
    </motion.div>
  );
}
