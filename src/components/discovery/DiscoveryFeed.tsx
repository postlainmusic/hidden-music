'use client';

/**
 * StreamingHub — DiscoveryFeed.tsx
 *
 * High-end dynamic Streaming Hub (Spotify / Apple Music aesthetic)
 * powered by Supabase Vault tracks + YouTube Music integration.
 *
 * Sections:
 *  1. Hero Spotlight Carousel   — Featured Vault albums with ambient glow + "Play All"
 *  2. Trending Quick Picks      — YTM trending tracks 2-row horizontal swipe grid
 *  3. New Releases Grid         — YTM new releases compact 4-col grid
 *  4. Mood Playlists Carousel   — YTM mood playlists with gradient covers
 *  5. Vault Tracks Swimlane     — Supabase tracks dispatched to PlayerContext
 *
 * Design: Pure Monochrome Cyber-Aesthetic (POSTLAIN brand)
 * bg-[#050507] · glass borders border-white/10 · frosted backdrops backdrop-blur-2xl
 */

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Heart,
  Plus,
  Check,
  Sparkles,
  Radio,
  Music2,
  ListMusic,
  ExternalLink,
  TrendingUp,
  Layers,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Album, TrackItem } from '@/types/database';
import type { YtmFeedResponse, YtmTrack, YtmAlbum, YtmPlaylist } from '@/types/ytm';
import { usePlayer } from '@/context/PlayerContext';
import { useTelemetry } from '@/hooks/useTelemetry';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StreamingHubProps {
  albums: Album[];
  ytmFeed: YtmFeedResponse | null;
  ytmLoading: boolean;
  onSelectAlbum?: (album: Album) => void;
  className?: string;
}

type FilterPill = 'All' | 'Vault' | 'Trending' | 'New Releases' | 'Playlists';

// ── Gradient palette for mood playlist cards (cycles through) ────────────────

const MOOD_GRADIENTS = [
  'from-zinc-800 to-zinc-950',
  'from-neutral-800 to-neutral-950',
  'from-stone-800 to-stone-950',
  'from-slate-800 to-slate-950',
  'from-gray-800 to-gray-950',
  'from-zinc-900 to-black',
  'from-neutral-900 to-black',
  'from-stone-900 to-black',
  'from-slate-900 to-black',
  'from-gray-900 to-black',
  'from-zinc-800 via-neutral-900 to-black',
  'from-stone-800 via-gray-900 to-black',
];

// ── Utility: format seconds to mm:ss ─────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Sub-component: Skeleton Card ─────────────────────────────────────────────

function SkeletonCard({ aspectRatio = 'square' }: { aspectRatio?: 'square' | 'video' }) {
  return (
    <div className="flex-shrink-0 w-44 sm:w-52 rounded-2xl overflow-hidden animate-pulse bg-zinc-900/60 border border-white/5">
      <div className={`w-full bg-zinc-800/60 ${aspectRatio === 'video' ? 'aspect-video' : 'aspect-square'}`} />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-zinc-800/60 rounded w-3/4" />
        <div className="h-2.5 bg-zinc-800/40 rounded w-1/2" />
      </div>
    </div>
  );
}

function SkeletonGridCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse bg-zinc-900/60 border border-white/5">
      <div className="w-full aspect-square bg-zinc-800/60" />
      <div className="p-2.5 space-y-1.5">
        <div className="h-2.5 bg-zinc-800/60 rounded w-3/4" />
        <div className="h-2 bg-zinc-800/40 rounded w-1/2" />
      </div>
    </div>
  );
}

// ── Sub-component: Section Header ─────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  subtitle?: string;
  onScrollLeft?: () => void;
  onScrollRight?: () => void;
}

function SectionHeader({
  icon,
  title,
  badge,
  subtitle,
  onScrollLeft,
  onScrollRight,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-1 mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/10 border border-white/10 text-white">
          {icon}
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-cyber font-black tracking-wider text-white uppercase flex items-center gap-2 flex-wrap">
            <span>{title}</span>
            {badge && (
              <span className="px-2 py-0.5 rounded-full bg-white text-black text-[9px] font-mono font-black tracking-widest">
                {badge}
              </span>
            )}
          </h2>
          {subtitle && (
            <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {(onScrollLeft || onScrollRight) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onScrollLeft}
            aria-label="Scroll left"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white border border-white/10 transition-all active:scale-90"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onScrollRight}
            aria-label="Scroll right"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white border border-white/10 transition-all active:scale-90"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function DiscoveryFeed({
  albums,
  ytmFeed,
  ytmLoading,
  onSelectAlbum,
  className = '',
}: StreamingHubProps) {
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { trackPlay, trackHeart, trackRecommendationClick } = useTelemetry();

  const [activeFilter, setActiveFilter] = useState<FilterPill>('All');
  const [heroIndex, setHeroIndex] = useState(0);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [addedQueueIds, setAddedQueueIds] = useState<Set<string>>(new Set());
  const [heroAnimating, setHeroAnimating] = useState(false);

  // ── Refs for carousel scroll lanes ──────────────────────────────────────────
  const laneRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollLane = useCallback((laneId: string, direction: 'left' | 'right') => {
    const el = laneRefs.current[laneId];
    if (!el) return;
    const amount = direction === 'left' ? -400 : 400;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  // ── Hero Carousel — featured vault albums ───────────────────────────────────
  const featuredAlbums = useMemo(
    () => albums.filter((a) => a.is_published && a.cover_url).slice(0, 6),
    [albums]
  );

  // Auto-advance hero every 6 seconds
  useEffect(() => {
    if (featuredAlbums.length <= 1) return;
    const timer = setInterval(() => {
      setHeroAnimating(true);
      setTimeout(() => {
        setHeroIndex((i) => (i + 1) % featuredAlbums.length);
        setHeroAnimating(false);
      }, 300);
    }, 6000);
    return () => clearInterval(timer);
  }, [featuredAlbums.length]);

  const navigateHero = useCallback(
    (dir: 'prev' | 'next') => {
      if (featuredAlbums.length === 0) return;
      setHeroAnimating(true);
      setTimeout(() => {
        setHeroIndex((i) =>
          dir === 'next'
            ? (i + 1) % featuredAlbums.length
            : (i - 1 + featuredAlbums.length) % featuredAlbums.length
        );
        setHeroAnimating(false);
      }, 200);
    },
    [featuredAlbums.length]
  );

  // ── Vault tracks aggregated across all albums ───────────────────────────────
  const vaultTracks = useMemo(() => {
    const list: { track: TrackItem; album: Album }[] = [];
    albums.forEach((album) => {
      (album.tracks ?? []).forEach((track) => {
        list.push({ track, album });
      });
    });
    return list;
  }, [albums]);

  // ── Handlers: Vault track play ──────────────────────────────────────────────
  const handlePlayVaultTrack = useCallback(
    (track: TrackItem, album: Album, sourceSection: string) => {
      trackRecommendationClick(track.id, sourceSection, album.id);
      const albumPlaylist = (album.tracks ?? [track]) as TrackItem[];
      // Cast to PlayerContext Track shape (compatible fields)
      playTrack(
        {
          id: track.id,
          album_id: track.album_id,
          title: track.title,
          artist: track.artist ?? album.artist,
          audio_url: track.audio_url,
          duration: track.duration,
          lyrics: track.lyrics,
        },
        {
          id: album.id,
          title: album.title,
          artist: album.artist,
          cover_url: album.cover_url,
        },
        albumPlaylist.map((t) => ({
          id: t.id,
          album_id: t.album_id,
          title: t.title,
          artist: t.artist ?? album.artist,
          audio_url: t.audio_url,
          duration: t.duration,
          lyrics: t.lyrics,
        }))
      );
      trackPlay(track.id, album.id, track.media_type ?? 'audio', sourceSection);
    },
    [playTrack, trackPlay, trackRecommendationClick]
  );

  // ── Handlers: play entire hero album ────────────────────────────────────────
  const handlePlayAllHero = useCallback(() => {
    const album = featuredAlbums[heroIndex];
    if (!album || !album.tracks || album.tracks.length === 0) return;
    handlePlayVaultTrack(album.tracks[0], album, 'hero_spotlight');
  }, [featuredAlbums, heroIndex, handlePlayVaultTrack]);

  // ── Handlers: Like / Heart ───────────────────────────────────────────────────
  const handleLike = useCallback(
    (trackId: string, e: React.MouseEvent, albumId?: string) => {
      e.stopPropagation();
      setLikedTrackIds((prev) => {
        const next = new Set(prev);
        const wasLiked = next.has(trackId);
        if (wasLiked) {
          next.delete(trackId);
        } else {
          next.add(trackId);
        }
        trackHeart(trackId, !wasLiked, albumId);
        return next;
      });
    },
    [trackHeart]
  );

  // ── Handlers: Add to queue (optimistic visual feedback) ─────────────────────
  const handleAddToQueue = useCallback(
    (track: TrackItem, album: Album, e: React.MouseEvent) => {
      e.stopPropagation();
      // No dedicated queue API — play the track as a new track start
      // and show brief feedback
      setAddedQueueIds((prev) => new Set(prev).add(track.id));
      setTimeout(() => {
        setAddedQueueIds((prev) => {
          const next = new Set(prev);
          next.delete(track.id);
          return next;
        });
      }, 2000);
    },
    []
  );

  // ── Filter visibility helpers ────────────────────────────────────────────────
  const show = useCallback(
    (section: Exclude<FilterPill, 'All'>) =>
      activeFilter === 'All' || activeFilter === section,
    [activeFilter]
  );

  // ── YTM data shortcuts ───────────────────────────────────────────────────────
  const ytmTrending = ytmFeed?.trending ?? [];
  const ytmNewReleases = ytmFeed?.newReleases ?? [];
  const ytmMoodPlaylists = ytmFeed?.moodPlaylists ?? [];

  const currentHeroAlbum = featuredAlbums[heroIndex] ?? null;

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className={`w-full space-y-10 select-none pb-36 ${className}`}>

      {/* ══════════════════════════════════════════════════════════════════════
          FILTER PILLS — Sticky top bar
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        id="streaming-hub-filters"
        className="sticky top-[68px] z-20 flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-black/90 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.8)] overflow-x-auto no-scrollbar"
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(['All', 'Vault', 'Trending', 'New Releases', 'Playlists'] as FilterPill[]).map(
            (pill) => (
              <button
                key={pill}
                id={`filter-pill-${pill.toLowerCase().replace(' ', '-')}`}
                onClick={() => setActiveFilter(pill)}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-mono font-bold tracking-wider whitespace-nowrap transition-all duration-200 active:scale-95 ${
                  activeFilter === pill
                    ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.35)]'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {pill}
              </button>
            )
          )}
        </div>
        {ytmFeed && (
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 flex-shrink-0 pr-1">
            <RefreshCw className="w-3 h-3" />
            <span>
              {new Date(ytmFeed.fetchedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1: HERO SPOTLIGHT CAROUSEL
      ══════════════════════════════════════════════════════════════════════ */}
      {show('Vault') && featuredAlbums.length > 0 && (
        <section id="section-hero-spotlight" className="animate-zoneFadeInSubtle">
          <div
            className={`relative w-full rounded-3xl overflow-hidden border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.9)] transition-all duration-500 ${
              heroAnimating ? 'opacity-60 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
            style={{ minHeight: 280 }}
          >
            {/* Ambient glow from cover art */}
            {currentHeroAlbum?.cover_url && (
              <div
                className="absolute inset-0 scale-110 blur-3xl opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `url(${currentHeroAlbum.cover_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            )}

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/30 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

            {/* Cover art on right */}
            {currentHeroAlbum?.cover_url && (
              <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-2/5 pointer-events-none">
                <img
                  src={currentHeroAlbum.cover_url}
                  alt={currentHeroAlbum.title}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />
              </div>
            )}

            {/* Content */}
            <div className="relative z-10 p-6 sm:p-10 flex flex-col justify-between" style={{ minHeight: 280 }}>
              {/* Track badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-white text-black text-[9px] font-mono font-black tracking-widest">
                  FEATURED
                </span>
                {currentHeroAlbum?.tracks && currentHeroAlbum.tracks.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white text-[9px] font-mono tracking-widest">
                    {currentHeroAlbum.tracks.length} TRACKS
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white text-[9px] font-mono tracking-widest">
                  {currentHeroAlbum?.original_year ?? 'VAULT'}
                </span>
              </div>

              {/* Album info */}
              <div className="mt-auto pt-8">
                <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5">
                  {currentHeroAlbum?.artist ?? 'POSTLAIN'}
                </p>
                <h2 className="text-2xl sm:text-4xl font-cyber font-black text-white uppercase leading-none tracking-tight mb-5 max-w-sm sm:max-w-xl">
                  {currentHeroAlbum?.title ?? '—'}
                </h2>

                {/* Action row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    id="hero-play-all-btn"
                    onClick={handlePlayAllHero}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white text-black font-cyber font-black text-sm uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    PLAY ALL
                  </button>
                  <button
                    onClick={() => currentHeroAlbum && onSelectAlbum?.(currentHeroAlbum)}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-mono text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                  >
                    <ListMusic className="w-3.5 h-3.5" />
                    VIEW ALBUM
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation arrows */}
            <button
              onClick={() => navigateHero('prev')}
              aria-label="Previous featured album"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 text-white transition-all hover:scale-110 active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigateHero('next')}
              aria-label="Next featured album"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 text-white transition-all hover:scale-110 active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
              {featuredAlbums.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === heroIndex
                      ? 'w-5 h-1.5 bg-white'
                      : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2: TRENDING QUICK PICKS (YouTube Music)
      ══════════════════════════════════════════════════════════════════════ */}
      {show('Trending') && (
        <section id="section-trending" className="animate-zoneFadeInSubtle">
          <SectionHeader
            icon={<TrendingUp className="w-4 h-4" />}
            title="Trending Quick Picks"
            badge="YOUTUBE MUSIC"
            subtitle="Top global tracks updated hourly"
            onScrollLeft={() => scrollLane('lane-trending', 'left')}
            onScrollRight={() => scrollLane('lane-trending', 'right')}
          />

          {ytmLoading ? (
            <div className="flex gap-3 overflow-x-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} aspectRatio="square" />
              ))}
            </div>
          ) : ytmTrending.length === 0 ? (
            <div className="py-10 text-center text-zinc-600 font-mono text-xs">
              TRENDING DATA UNAVAILABLE — CHECK BACK SOON
            </div>
          ) : (
            <div
              ref={(el) => { laneRefs.current['lane-trending'] = el; }}
              id="lane-trending"
              className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-2"
            >
              {/* 2 rows: split array into 2 rows of interleaved cards */}
              <div className="flex flex-col gap-3 flex-shrink-0">
                {ytmTrending.slice(0, Math.ceil(ytmTrending.length / 2)).map(
                  (track, i) => (
                    <YtmTrackCard
                      key={track.ytmId}
                      track={track}
                      rank={i + 1}
                    />
                  )
                )}
              </div>
              <div className="flex flex-col gap-3 flex-shrink-0">
                {ytmTrending.slice(Math.ceil(ytmTrending.length / 2)).map(
                  (track, i) => (
                    <YtmTrackCard
                      key={track.ytmId}
                      track={track}
                      rank={Math.ceil(ytmTrending.length / 2) + i + 1}
                    />
                  )
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3: NEW RELEASES GRID (YouTube Music)
      ══════════════════════════════════════════════════════════════════════ */}
      {show('New Releases') && (
        <section id="section-new-releases" className="animate-zoneFadeInSubtle">
          <SectionHeader
            icon={<Sparkles className="w-4 h-4" />}
            title="New Releases"
            badge="YTM"
            subtitle="Latest albums & singles from YouTube Music"
          />

          {ytmLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonGridCard key={i} />
              ))}
            </div>
          ) : ytmNewReleases.length === 0 ? (
            <div className="py-10 text-center text-zinc-600 font-mono text-xs">
              NEW RELEASES UNAVAILABLE — CHECK BACK SOON
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {ytmNewReleases.map((album) => (
                <YtmAlbumCard key={album.ytmId} album={album} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4: MOOD & GENRE PLAYLISTS (YouTube Music)
      ══════════════════════════════════════════════════════════════════════ */}
      {show('Playlists') && (
        <section id="section-mood-playlists" className="animate-zoneFadeInSubtle">
          <SectionHeader
            icon={<Radio className="w-4 h-4" />}
            title="Curated Moods & Genres"
            badge="YTM"
            subtitle="Horizontally curated playlists for every vibe"
            onScrollLeft={() => scrollLane('lane-moods', 'left')}
            onScrollRight={() => scrollLane('lane-moods', 'right')}
          />

          {ytmLoading ? (
            <div className="flex gap-3 overflow-x-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} aspectRatio="square" />
              ))}
            </div>
          ) : ytmMoodPlaylists.length === 0 ? (
            <div className="py-10 text-center text-zinc-600 font-mono text-xs">
              PLAYLISTS UNAVAILABLE — CHECK BACK SOON
            </div>
          ) : (
            <div
              ref={(el) => { laneRefs.current['lane-moods'] = el; }}
              id="lane-moods"
              className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-2"
            >
              {ytmMoodPlaylists.map((playlist, i) => (
                <MoodPlaylistCard
                  key={playlist.ytmId}
                  playlist={playlist}
                  gradient={MOOD_GRADIENTS[i % MOOD_GRADIENTS.length]}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 5: VAULT TRACKS (Supabase — dispatched to PlayerContext)
      ══════════════════════════════════════════════════════════════════════ */}
      {show('Vault') && vaultTracks.length > 0 && (
        <section id="section-vault-tracks" className="animate-zoneFadeInSubtle">
          <SectionHeader
            icon={<Music2 className="w-4 h-4" />}
            title="Hidden Vault"
            badge="LOSSLESS"
            subtitle="Exclusive unreleased & vault recordings"
            onScrollLeft={() => scrollLane('lane-vault', 'left')}
            onScrollRight={() => scrollLane('lane-vault', 'right')}
          />

          <div
            ref={(el) => { laneRefs.current['lane-vault'] = el; }}
            id="lane-vault"
            className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2"
          >
            {vaultTracks.map(({ track, album }, index) => {
              const isCur = currentTrack?.id === track.id;
              const isLiked = likedTrackIds.has(track.id);
              const isAdded = addedQueueIds.has(track.id);

              return (
                <div
                  key={track.id || index}
                  id={`vault-track-${track.id}`}
                  onClick={() => handlePlayVaultTrack(track, album, 'vault_swimlane')}
                  className={`group relative w-44 sm:w-52 flex-shrink-0 snap-start rounded-2xl overflow-hidden bg-zinc-950 border transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-95 ${
                    isCur
                      ? 'border-white ring-1 ring-white/40 shadow-[0_0_24px_rgba(255,255,255,0.12)]'
                      : 'border-white/10 hover:border-white/35'
                  }`}
                >
                  {/* Cover Art */}
                  <div className="relative w-full aspect-square bg-zinc-900">
                    {album.cover_url ? (
                      <img
                        src={album.cover_url}
                        alt={track.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Disc3 className="w-12 h-12 text-zinc-700" />
                      </div>
                    )}

                    {/* Hover action overlay */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5">
                      <button
                        onClick={(e) => handleAddToQueue(track, album, e)}
                        aria-label="Add to queue"
                        className="p-2.5 rounded-full bg-black/80 hover:bg-white text-white hover:text-black border border-white/20 transition-all shadow-lg hover:scale-110 active:scale-90"
                      >
                        {isAdded ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.7)] transition-transform hover:scale-110 active:scale-90">
                        {isCur && isPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </div>

                      <button
                        onClick={(e) => handleLike(track.id, e, album.id)}
                        aria-label={isLiked ? 'Unlike' : 'Like'}
                        className={`p-2.5 rounded-full border transition-all shadow-lg hover:scale-110 active:scale-90 ${
                          isLiked
                            ? 'bg-white text-black border-white'
                            : 'bg-black/80 text-white hover:bg-white hover:text-black border-white/20'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Currently playing indicator */}
                    {isCur && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white text-black text-[8px] font-mono font-black tracking-widest flex items-center gap-1">
                        <Disc3 className="w-2.5 h-2.5 animate-spin" />
                        NOW
                      </div>
                    )}

                    {/* LOSSLESS badge */}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-[8px] font-mono text-zinc-300 font-black">
                      LOSSLESS
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-3">
                    <h4 className="text-[11px] font-cyber font-extrabold text-white truncate uppercase leading-tight">
                      {track.title}
                    </h4>
                    <p className="text-[10px] font-mono text-zinc-500 truncate mt-0.5 uppercase">
                      {track.artist ?? album.artist}
                    </p>
                    {track.duration > 0 && (
                      <p className="text-[9px] font-mono text-zinc-600 mt-1 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDuration(track.duration)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ── YTM Card Sub-Components ───────────────────────────────────────────────────

/** Compact horizontal track row for trending section */
function YtmTrackCard({ track, rank }: { track: YtmTrack; rank: number }) {
  const handleOpen = useCallback(() => {
    window.open(track.youtubeUrl, '_blank', 'noopener,noreferrer');
  }, [track.youtubeUrl]);

  return (
    <button
      id={`ytm-track-${track.ytmId}`}
      onClick={handleOpen}
      aria-label={`Open ${track.title} on YouTube Music`}
      className="group flex items-center gap-3 w-64 sm:w-72 flex-shrink-0 snap-start p-2.5 rounded-xl bg-zinc-950/80 border border-white/10 hover:border-white/25 hover:bg-zinc-900/90 transition-all duration-200 active:scale-95 text-left"
    >
      {/* Rank */}
      <span className="text-[10px] font-mono font-black text-zinc-600 w-5 text-center flex-shrink-0">
        {rank}
      </span>

      {/* Thumbnail */}
      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 className="w-4 h-4 text-zinc-600" />
          </div>
        )}
        {/* Play icon on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-3.5 h-3.5 fill-white text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-cyber font-bold text-white truncate uppercase leading-tight">
          {track.title}
        </p>
        <p className="text-[10px] font-mono text-zinc-500 truncate uppercase mt-0.5">
          {track.artist}
        </p>
      </div>

      {/* External link icon */}
      <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
    </button>
  );
}

/** Compact grid card for New Releases section */
function YtmAlbumCard({ album }: { album: YtmAlbum }) {
  const handleOpen = useCallback(() => {
    window.open(album.browseUrl, '_blank', 'noopener,noreferrer');
  }, [album.browseUrl]);

  return (
    <button
      id={`ytm-album-${album.ytmId}`}
      onClick={handleOpen}
      aria-label={`Open ${album.title} on YouTube Music`}
      className="group flex flex-col rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 hover:border-white/30 transition-all duration-250 hover:scale-[1.04] active:scale-95 shadow-md hover:shadow-xl text-left"
    >
      {/* Cover art */}
      <div className="relative w-full aspect-square bg-zinc-900 overflow-hidden">
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers className="w-8 h-8 text-zinc-700" />
          </div>
        )}

        {/* Release type tag */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/20 text-[8px] font-mono font-black text-white">
          {album.releaseType}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-2.5">
        <h4 className="text-[10px] font-cyber font-extrabold text-white truncate uppercase leading-tight">
          {album.title}
        </h4>
        <p className="text-[9px] font-mono text-zinc-500 truncate mt-0.5 uppercase">
          {album.artist}
        </p>
        {album.year && (
          <p className="text-[9px] font-mono text-zinc-700 mt-0.5">{album.year}</p>
        )}
      </div>
    </button>
  );
}

/** Horizontally scrollable mood playlist card */
function MoodPlaylistCard({
  playlist,
  gradient,
}: {
  playlist: YtmPlaylist;
  gradient: string;
}) {
  const handleOpen = useCallback(() => {
    window.open(playlist.browseUrl, '_blank', 'noopener,noreferrer');
  }, [playlist.browseUrl]);

  return (
    <button
      id={`ytm-playlist-${playlist.ytmId}`}
      onClick={handleOpen}
      aria-label={`Open ${playlist.title} playlist on YouTube Music`}
      className={`group relative flex-shrink-0 snap-start w-40 sm:w-48 rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} border border-white/10 hover:border-white/30 transition-all duration-250 hover:scale-[1.04] active:scale-95 shadow-lg hover:shadow-2xl text-left`}
    >
      <div className="p-4 pb-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center mb-3 transition-transform group-hover:scale-110">
          <Radio className="w-5 h-5 text-white" />
        </div>

        <h4 className="text-[11px] font-cyber font-black text-white uppercase leading-tight line-clamp-2">
          {playlist.title}
        </h4>
        <p className="text-[9px] font-mono text-zinc-400 mt-1">YOUTUBE MUSIC</p>
      </div>

      {/* Bottom strip */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <span className="text-[9px] font-mono text-zinc-500">PLAYLIST</span>
        <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-white transition-colors" />
      </div>
    </button>
  );
}
