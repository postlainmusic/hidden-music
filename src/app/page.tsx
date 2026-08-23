'use client';

/**
 * Home Page (/) — POSTLAIN GenZ Discovery Feed Hub
 *
 * Audiophile Cyber-Deck Experience:
 *  - High-res dynamic spotlight cards (21st.dev style)
 *  - Multi-tier AI Synced Lyrics & Cinema 4K Player
 *  - 120 FPS Framer Motion Animations & Closed Loop Audio Graph
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Radio, Disc3, Sparkles } from 'lucide-react';
import Navbar from '@/components/ui/Navbar';
import DiscoveryFeed from '@/components/discovery/DiscoveryFeed';
import VideoPaywallModal from '@/components/ui/VideoPaywallModal';
import { createClient } from '@/lib/supabase/client';
import { Album } from '@/types/database';
import type { YtmFeedResponse } from '@/types/ytm';
import { usePlayer } from '@/context/PlayerContext';
import { getStoredUserSession } from '@/lib/authSession';
import VaultGate from '@/components/ui/VaultGate';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [ytmFeed, setYtmFeed] = useState<YtmFeedResponse | null>(null);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [ytmLoading, setYtmLoading] = useState(true);
  const [userSession, setUserSession] = useState<any>(null);

  const player = usePlayer();
  const isPaywallOpen = (player as any).isPaywallOpen ?? false;
  const closePaywall = (player as any).closePaywall ?? (() => {});

  useEffect(() => {
    setMounted(true);
    const session = getStoredUserSession();
    setUserSession(session);

    // Parallel fetch Supabase albums + YTM stream feed
    const loadAlbums = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('albums')
          .select('*, tracks(*)')
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setAlbums(data);
        }
      } catch (e) {
        console.error('[HomePage] Supabase fetch error:', e);
      } finally {
        setAlbumsLoading(false);
      }
    };

    const loadYtmFeed = async () => {
      try {
        const res = await fetch('/api/ytm/feed', {
          next: { revalidate: 3600 },
        } as RequestInit);
        if (res.ok) {
          const data: YtmFeedResponse = await res.json();
          setYtmFeed(data);
        }
      } catch (e) {
        console.debug('[HomePage] YTM feed fetch error:', e);
      } finally {
        setYtmLoading(false);
      }
    };

    Promise.all([loadAlbums(), loadYtmFeed()]);
  }, []);

  // SSR / Mount placeholder to prevent Hydration mismatch
  if (!mounted) {
    return (
      <main className="min-h-screen w-full bg-black flex items-center justify-center font-mono select-none">
        <div className="tv-grain-overlay" />
        <div className="crt-scanlines" />
        <div className="flex items-center gap-3 text-slate-400">
          <Disc3 className="w-6 h-6 animate-spin text-white" />
          <span className="text-xs uppercase tracking-widest font-cyber">INITIALIZING STREAMING HUB...</span>
        </div>
      </main>
    );
  }

  // Mandatory Session check before accessing Discovery Feed
  if (!userSession) {
    return <VaultGate />;
  }

  return (
    <main
      id="discovery-hub-page"
      className="min-h-screen w-full bg-[#050507] text-white select-none relative pb-32"
    >
      {/* Dynamic Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05)_0%,transparent_65%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-30" />

      {/* Top Navbar with Feed ⇄ 3D Vault Switcher */}
      <Navbar
        userEmail={userSession?.email}
        title="DISCOVERY FEED // POSTLAIN"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-20 sm:pt-24 flex flex-col gap-6 sm:gap-8 relative z-10">
        {/* Page Hero Banner */}
        <div className="rounded-3xl bg-zinc-950/60 border border-white/10 p-5 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <div className="absolute -top-10 -right-10 w-72 h-72 bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono tracking-widest text-zinc-300 mb-3">
                <Zap className="w-3 h-3 text-white" />
                <span>POSTLAIN AUDIO ENGINE // CYBER DECK</span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase font-cyber tracking-tight text-white mb-2 leading-none">
                DISCOVERY FEED
              </h1>
              <p className="text-[11px] sm:text-xs text-zinc-400 font-mono max-w-lg leading-relaxed">
                Không gian khám phá âm nhạc không giới hạn — bảng xếp hạng thịnh hành, bản phát hành mới, MV 4K và kho đĩa phòng thu độc quyền.
              </p>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex-shrink-0 self-start sm:self-auto">
              <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">
                {ytmLoading ? 'ĐANG TẢI...' : 'CYBER STREAM 120 FPS'}
              </span>
            </div>
          </div>
        </div>

        {/* Streaming Hub Feed */}
        <DiscoveryFeed
          albums={albums}
          ytmFeed={ytmFeed}
          ytmLoading={ytmLoading || albumsLoading}
          onSelectAlbum={(album) => router.push(`/album/${album.id}`)}
        />
      </div>

      {/* Paywall Modal */}
      <VideoPaywallModal
        isOpen={isPaywallOpen}
        onClose={closePaywall}
      />
    </main>
  );
}
