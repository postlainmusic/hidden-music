'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Disc3, Sparkles, ArrowLeft, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/ui/Navbar';
import DiscoveryFeed from '@/components/discovery/DiscoveryFeed';
import VideoPaywallModal from '@/components/ui/VideoPaywallModal';
import { createClient } from '@/lib/supabase/client';
import { Album } from '@/types/database';
import { usePlayer } from '@/context/PlayerContext';
import { getStoredUserSession, hasActiveSession } from '@/lib/authSession';
import VaultGate from '@/components/ui/VaultGate';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function DiscoverPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSession, setUserSession] = useState<any>(null);
  const { isPaywallOpen, closePaywall } = usePlayer();

  useEffect(() => {
    setUserSession(getStoredUserSession());

    const loadAlbums = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('albums')
          .select('*, tracks(*)')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setAlbums(data);
        }
      } catch (e) {
        console.error('Error fetching discovery data:', e);
      } finally {
        setLoading(false);
      }
    };

    loadAlbums();
  }, []);

  if (!hasActiveSession()) {
    return <VaultGate />;
  }

  return (
    <main className="min-h-screen w-full bg-[#07070a] text-white select-none relative pb-32">
      {/* Dynamic Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />

      {/* Navbar */}
      <Navbar
        userEmail={userSession?.email}
        showBackButton={true}
        onBackClick={() => router.push('/')}
        title="AI DISCOVERY // POSTLAIN FEED"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 flex flex-col gap-6 relative z-10">
        {/* Header Hero Banner */}
        <div className="rounded-3xl bg-zinc-950/80 border border-white/15 p-6 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-mono tracking-widest text-zinc-300 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>AI RECOMMENDATION ENGINE</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase font-cyber tracking-tight text-white mb-2">
            MULTIMEDIA DISCOVERY FEED
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 font-mono max-w-xl leading-relaxed">
            Hệ thống gợi ý thông minh phân tích sở thích âm nhạc và phim ảnh của bạn theo thời gian thực, tổng hợp các ấn phẩm âm thanh lossless và MV 4K bị ẩn độc quyền.
          </p>
        </div>

        {/* Loading Spinner or Feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400 font-mono">
            <Disc3 className="w-8 h-8 animate-spin text-white" />
            <span className="text-xs uppercase tracking-widest">LOADING DISCOVERY FEED...</span>
          </div>
        ) : (
          <DiscoveryFeed
            albums={albums}
            onSelectAlbum={(album) => router.push(`/album/${album.id}`)}
          />
        )}
      </div>

      {/* Paywall Modal */}
      <VideoPaywallModal
        isOpen={isPaywallOpen}
        onClose={closePaywall}
      />
    </main>
  );
}
