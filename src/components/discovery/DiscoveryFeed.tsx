'use client';

/**
 * StreamingHub — DiscoveryFeed.tsx (v2)
 *
 * Closed-loop In-App Streaming Experience (Spotify / Apple Music style).
 * Zero external redirections — everything plays inside the app.
 *
 * Sections:
 *  0. Native Search Bar (debounced, 300ms) → /api/ytm/search
 *  1. Hero Spotlight Carousel    — Vault albums: ambient glow + Play All
 *  2. V-Hop & V-R&B              — Curated Vietnamese Hip-hop / R&B
 *  3. Trending Quick Picks       — YTM charts 2-row horizontal grid
 *  4. Global Hits                — Global Trap / Melodic / Trapsoul
 *  5. Lo-fi / Late-Night Chill   — Curated mood swimlane
 *  6. New Releases Grid          — YTM new releases 4-5 col grid
 *  7. Mood & Genre Playlists     — YTM mood playlists horizontal scroll
 *  8. Vault Lossless             — Supabase tracks → PlayerContext direct
 *
 * In-app playback:
 *  - Vault tracks → PlayerContext.playTrack() directly
 *  - YTM tracks → /api/ytm/resolve → PlayerContext.playTrack() with resolved URL
 *
 * Design: Pure Monochrome Cyber-Aesthetic (POSTLAIN brand)
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
  TrendingUp,
  Layers,
  Clock,
  RefreshCw,
  Search,
  X,
  Loader2,
  AlertCircle,
  Globe,
  Moon,
} from 'lucide-react';
import { Album, TrackItem } from '@/types/database';
import type {
  YtmFeedResponse,
  YtmTrack,
  YtmAlbum,
  YtmPlaylist,
  YtmSearchResponse,
  YtmResolvedStream,
  YtmResolveError,
} from '@/types/ytm';
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

type FilterPill = 'All' | 'V-Hop & R&B' | 'Global Hits' | 'Lo-fi / Chill' | 'New Releases' | 'Vault Lossless';

// ── Gradient palette for mood playlist cards ──────────────────────────────────
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

// ── Utility: format seconds to m:ss ──────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Utility: debounce ─────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ── Sub-components: Skeleton Cards ────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-44 sm:w-52 rounded-2xl overflow-hidden animate-pulse bg-zinc-900/60 border border-white/5">
      <div className="w-full aspect-square bg-zinc-800/60" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-zinc-800/60 rounded w-3/4" />
        <div className="h-2.5 bg-zinc-800/40 rounded w-1/2" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl animate-pulse bg-zinc-900/40">
      <div className="w-5 h-3 bg-zinc-800/60 rounded flex-shrink-0" />
      <div className="w-10 h-10 rounded-lg bg-zinc-800/60 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
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

// ── Sub-component: Section Header ──────────────────────────────────────────────
interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  subtitle?: string;
  onScrollLeft?: () => void;
  onScrollRight?: () => void;
}

function SectionHeader({ icon, title, badge, subtitle, onScrollLeft, onScrollRight }: SectionHeaderProps) {
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
          {subtitle && <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {(onScrollLeft || onScrollRight) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onScrollLeft} aria-label="Scroll left" className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white border border-white/10 transition-all active:scale-90">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={onScrollRight} aria-label="Scroll right" className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white border border-white/10 transition-all active:scale-90">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── In-app YTM track card ─────────────────────────────────────────────────────
interface YtmTrackRowProps {
  track: YtmTrack;
  rank?: number;
  isResolving: boolean;
  isPlaying: boolean;
  isCurrent: boolean;
  onPlay: () => void;
}

function YtmTrackRow({ track, rank, isResolving, isPlaying, isCurrent, onPlay }: YtmTrackRowProps) {
  return (
    <button
      id={`ytm-track-row-${track.ytmId}`}
      onClick={onPlay}
      disabled={isResolving}
      aria-label={`Play ${track.title}`}
      className={`group flex items-center gap-3 w-64 sm:w-72 flex-shrink-0 snap-start p-2.5 rounded-xl border transition-all duration-200 active:scale-95 text-left ${
        isCurrent
          ? 'bg-white/10 border-white/30 shadow-[0_0_16px_rgba(255,255,255,0.08)]'
          : 'bg-zinc-950/80 border-white/10 hover:border-white/25 hover:bg-zinc-900/90'
      } ${isResolving ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
    >
      <span className="text-[10px] font-mono font-black text-zinc-600 w-5 text-center flex-shrink-0">
        {rank ?? ''}
      </span>
      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
        {track.coverUrl ? (
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 className="w-4 h-4 text-zinc-600" />
          </div>
        )}
        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${isCurrent || isResolving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {isResolving ? (
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          ) : isCurrent && isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-white text-white" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white text-white" />
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-cyber font-bold truncate uppercase leading-tight ${isCurrent ? 'text-white' : 'text-white/90'}`}>
          {track.title}
        </p>
        <p className="text-[10px] font-mono text-zinc-500 truncate uppercase mt-0.5">
          {track.artist}
        </p>
      </div>
      {track.duration > 0 && (
        <span className="text-[9px] font-mono text-zinc-600 flex-shrink-0">
          {formatDuration(track.duration)}
        </span>
      )}
      {isCurrent && isPlaying && (
        <Disc3 className="w-3.5 h-3.5 text-white animate-spin flex-shrink-0" />
      )}
    </button>
  );
}

// ── In-app YTM compact card (for grid/carousel) ────────────────────────────────
interface YtmCompactCardProps {
  track: YtmTrack;
  isResolving: boolean;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

function YtmCompactCard({ track, isResolving, isCurrent, isPlaying, onPlay }: YtmCompactCardProps) {
  return (
    <button
      id={`ytm-card-${track.ytmId}`}
      onClick={onPlay}
      disabled={isResolving}
      aria-label={`Play ${track.title}`}
      className={`group relative flex-shrink-0 snap-start w-44 sm:w-52 rounded-2xl overflow-hidden border transition-all duration-250 active:scale-95 text-left ${
        isCurrent
          ? 'border-white ring-1 ring-white/40 shadow-[0_0_20px_rgba(255,255,255,0.10)]'
          : 'border-white/10 hover:border-white/30 hover:scale-[1.03]'
      } ${isResolving ? 'cursor-wait' : 'cursor-pointer'}`}
    >
      <div className="relative w-full aspect-square bg-zinc-900">
        {track.coverUrl ? (
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900">
            <Music2 className="w-10 h-10 text-zinc-700" />
          </div>
        )}
        <div className={`absolute inset-0 bg-black/55 flex items-center justify-center transition-opacity ${isCurrent || isResolving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.6)]">
            {isResolving ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : isCurrent && isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </div>
        </div>
        {isCurrent && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white text-black text-[8px] font-mono font-black tracking-widest flex items-center gap-1">
            <Disc3 className="w-2.5 h-2.5 animate-spin" />
            NOW
          </div>
        )}
      </div>
      <div className="p-3 bg-zinc-950">
        <h4 className="text-[11px] font-cyber font-extrabold text-white truncate uppercase leading-tight">
          {track.title}
        </h4>
        <p className="text-[10px] font-mono text-zinc-500 truncate mt-0.5 uppercase">
          {track.artist}
        </p>
      </div>
    </button>
  );
}

// ── New Releases Album Card ────────────────────────────────────────────────────
function YtmAlbumCard({ album }: { album: YtmAlbum }) {
  return (
    <div
      id={`ytm-album-${album.ytmId}`}
      className="group flex flex-col rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 hover:border-white/30 transition-all duration-250 hover:scale-[1.04] active:scale-95 shadow-md hover:shadow-xl"
    >
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
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/20 text-[8px] font-mono font-black text-white">
          {album.releaseType}
        </div>
      </div>
      <div className="p-2.5">
        <h4 className="text-[10px] font-cyber font-extrabold text-white truncate uppercase leading-tight">
          {album.title}
        </h4>
        <p className="text-[9px] font-mono text-zinc-500 truncate mt-0.5 uppercase">
          {album.artist}
        </p>
      </div>
    </div>
  );
}

// ── Mood Playlist Card ────────────────────────────────────────────────────────
function MoodPlaylistCard({ playlist, gradient }: { playlist: YtmPlaylist; gradient: string }) {
  return (
    <button
      id={`ytm-playlist-${playlist.ytmId}`}
      aria-label={`Browse ${playlist.title}`}
      className={`group relative flex-shrink-0 snap-start w-40 sm:w-48 rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} border border-white/10 hover:border-white/30 transition-all duration-250 hover:scale-[1.04] active:scale-95 shadow-lg hover:shadow-2xl text-left`}
    >
      <div className="p-4 pb-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center mb-3 transition-transform group-hover:scale-110">
          <Radio className="w-5 h-5 text-white" />
        </div>
        <h4 className="text-[11px] font-cyber font-black text-white uppercase leading-tight line-clamp-2">
          {playlist.title}
        </h4>
        <p className="text-[9px] font-mono text-zinc-400 mt-1">MOOD PLAYLIST</p>
      </div>
      <div className="px-4 pb-3">
        <span className="text-[9px] font-mono text-zinc-500">YTM CURATED</span>
      </div>
    </button>
  );
}

// ── Error Toast ────────────────────────────────────────────────────────────────
function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-zinc-900/95 border border-white/20 text-white text-xs font-mono shadow-2xl backdrop-blur-xl animate-slideUp max-w-xs">
      <AlertCircle className="w-4 h-4 text-zinc-400 flex-shrink-0" />
      <span className="truncate">{message}</span>
      <button onClick={onDismiss} className="ml-1 flex-shrink-0 hover:text-zinc-300 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Search Results Section ────────────────────────────────────────────────────
interface SearchResultsProps {
  results: YtmSearchResponse;
  resolvingIds: Set<string>;
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayYtmTrack: (track: YtmTrack) => void;
}

function SearchResults({ results, resolvingIds, currentTrackId, isPlaying, onPlayYtmTrack }: SearchResultsProps) {
  const hasResults =
    results.topResult !== null ||
    results.songs.length > 0 ||
    results.albums.length > 0;

  if (!hasResults) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
        <Search className="w-8 h-8" />
        <p className="font-mono text-sm">Không tìm thấy kết quả cho "{results.query}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-zoneFadeInSubtle">
      {/* Top Result */}
      {results.topResult && (
        <section>
          <SectionHeader icon={<Sparkles className="w-4 h-4" />} title="Kết quả hàng đầu" />
          {'ytmId' in results.topResult && 'youtubeUrl' in results.topResult ? (
            <YtmCompactCard
              track={results.topResult as YtmTrack}
              isResolving={resolvingIds.has((results.topResult as YtmTrack).ytmId)}
              isCurrent={currentTrackId === (results.topResult as YtmTrack).ytmId}
              isPlaying={isPlaying}
              onPlay={() => onPlayYtmTrack(results.topResult as YtmTrack)}
            />
          ) : (
            <YtmAlbumCard album={results.topResult as YtmAlbum} />
          )}
        </section>
      )}

      {/* Songs */}
      {results.songs.length > 0 && (
        <section>
          <SectionHeader icon={<Music2 className="w-4 h-4" />} title="Bài hát" badge={`${results.songs.length}`} />
          <div className="space-y-1">
            {results.songs.map((track, i) => (
              <YtmTrackRow
                key={track.ytmId}
                track={track}
                rank={i + 1}
                isResolving={resolvingIds.has(track.ytmId)}
                isCurrent={currentTrackId === track.ytmId}
                isPlaying={isPlaying}
                onPlay={() => onPlayYtmTrack(track)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Albums */}
      {results.albums.length > 0 && (
        <section>
          <SectionHeader icon={<Layers className="w-4 h-4" />} title="Album & Single" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {results.albums.map((album) => (
              <YtmAlbumCard key={album.ytmId} album={album} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function DiscoveryFeed({
  albums,
  ytmFeed,
  ytmLoading,
  onSelectAlbum,
  className = '',
}: StreamingHubProps) {
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { trackPlay, trackHeart, trackRecommendationClick } = useTelemetry();

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<FilterPill>('All');
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroAnimating, setHeroAnimating] = useState(false);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [addedQueueIds, setAddedQueueIds] = useState<Set<string>>(new Set());

  // YTM in-app resolve state
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [currentYtmId, setCurrentYtmId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YtmSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const laneRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isSearchMode = debouncedQuery.length >= 2;

  // ── Lane scroll ────────────────────────────────────────────────────────────
  const scrollLane = useCallback((laneId: string, direction: 'left' | 'right') => {
    const el = laneRefs.current[laneId];
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -400 : 400, behavior: 'smooth' });
  }, []);

  // ── Hero carousel ──────────────────────────────────────────────────────────
  const featuredAlbums = useMemo(
    () => albums.filter((a) => a.is_published && a.cover_url).slice(0, 6),
    [albums]
  );

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

  const navigateHero = useCallback((dir: 'prev' | 'next') => {
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
  }, [featuredAlbums.length]);

  // ── Vault tracks ───────────────────────────────────────────────────────────
  const vaultTracks = useMemo(() => {
    const list: { track: TrackItem; album: Album }[] = [];
    albums.forEach((album) => {
      (album.tracks ?? []).forEach((track) => list.push({ track, album }));
    });
    return list;
  }, [albums]);

  // ── Vault play handler ─────────────────────────────────────────────────────
  const handlePlayVaultTrack = useCallback(
    (track: TrackItem, album: Album, sourceSection: string) => {
      trackRecommendationClick(track.id, sourceSection, album.id);
      const albumPlaylist = (album.tracks ?? [track]) as TrackItem[];
      playTrack(
        { id: track.id, album_id: track.album_id, title: track.title, artist: track.artist ?? album.artist, audio_url: track.audio_url, duration: track.duration, lyrics: track.lyrics },
        { id: album.id, title: album.title, artist: album.artist, cover_url: album.cover_url },
        albumPlaylist.map((t) => ({ id: t.id, album_id: t.album_id, title: t.title, artist: t.artist ?? album.artist, audio_url: t.audio_url, duration: t.duration, lyrics: t.lyrics }))
      );
      trackPlay(track.id, album.id, track.media_type ?? 'audio', sourceSection);
    },
    [playTrack, trackPlay, trackRecommendationClick]
  );

  // ── YTM in-app play handler (Instant Dual-Engine playback) ───────────────
  const handlePlayYtmTrack = useCallback(
    (track: YtmTrack) => {
      if (currentYtmId === track.ytmId && isPlaying) return;

      setCurrentYtmId(track.ytmId);

      playTrack(
        {
          id: track.ytmId,
          title: track.title,
          artist: track.artist,
          audio_url: `yt:${track.ytmId}`,
          youtube_id: track.ytmId,
          duration: track.duration,
        },
        {
          id: `ytm_${track.ytmId}`,
          title: track.title,
          artist: track.artist,
          cover_url: track.coverUrl,
        },
        []
      );

      trackPlay(track.ytmId, undefined, 'audio', 'ytm_streaming_hub');
    },
    [currentYtmId, isPlaying, playTrack, trackPlay]
  );

  // ── Hero Play All ──────────────────────────────────────────────────────────
  const handlePlayAllHero = useCallback(() => {
    const album = featuredAlbums[heroIndex];
    if (!album?.tracks?.length) return;
    handlePlayVaultTrack(album.tracks[0], album, 'hero_spotlight');
  }, [featuredAlbums, heroIndex, handlePlayVaultTrack]);

  // ── Like handler ───────────────────────────────────────────────────────────
  const handleLike = useCallback(
    (trackId: string, e: React.MouseEvent, albumId?: string) => {
      e.stopPropagation();
      setLikedTrackIds((prev) => {
        const next = new Set(prev);
        const wasLiked = next.has(trackId);
        wasLiked ? next.delete(trackId) : next.add(trackId);
        trackHeart(trackId, !wasLiked, albumId);
        return next;
      });
    },
    [trackHeart]
  );

  // ── Queue feedback ─────────────────────────────────────────────────────────
  const handleAddToQueue = useCallback((track: TrackItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddedQueueIds((prev) => new Set(prev).add(track.id));
    setTimeout(() => {
      setAddedQueueIds((prev) => { const n = new Set(prev); n.delete(track.id); return n; });
    }, 2000);
  }, []);

  // ── Search effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);

    fetch(`/api/ytm/search?q=${encodeURIComponent(debouncedQuery)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: YtmSearchResponse) => {
        setSearchResults(data);
        setSearchLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setSearchLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  // ── Filter visibility ──────────────────────────────────────────────────────
  const show = useCallback(
    (section: Exclude<FilterPill, 'All'>) => activeFilter === 'All' || activeFilter === section,
    [activeFilter]
  );

  // ── Data shortcuts ─────────────────────────────────────────────────────────
  const ytmTrending = ytmFeed?.trending ?? [];
  const ytmNewReleases = ytmFeed?.newReleases ?? [];
  const ytmMoodPlaylists = ytmFeed?.moodPlaylists ?? [];
  const curatedVhop = ytmFeed?.curatedVhop ?? [];
  const curatedGlobal = ytmFeed?.curatedGlobal ?? [];
  const curatedLofi = ytmFeed?.curatedLofi ?? [];
  const currentHeroAlbum = featuredAlbums[heroIndex] ?? null;
  const currentTrackId = currentTrack?.id ?? null;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className={`w-full space-y-10 select-none pb-36 ${className}`}>

      {/* Error Toast */}
      {resolveError && (
        <ErrorToast message={resolveError} onDismiss={() => setResolveError(null)} />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SEARCH BAR
      ════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-[68px] z-30 space-y-2">
        {/* Search input */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-black/95 backdrop-blur-2xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.9)]">
          <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <input
            ref={searchInputRef}
            id="streaming-hub-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm bài hát, artist, album..."
            className="flex-1 bg-transparent text-white text-sm font-mono placeholder-zinc-600 outline-none caret-white"
            style={{ cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text' }}
          />
          {searchLoading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin flex-shrink-0" />}
          {searchQuery && !searchLoading && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="p-0.5 rounded-full text-zinc-500 hover:text-white transition-colors active:scale-90 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        {!isSearchMode && (
          <div className="flex items-center justify-between gap-1.5 px-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {(['All', 'V-Hop & R&B', 'Global Hits', 'Lo-fi / Chill', 'New Releases', 'Vault Lossless'] as FilterPill[]).map((pill) => (
                <button
                  key={pill}
                  id={`filter-pill-${pill.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  onClick={() => setActiveFilter(pill)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold tracking-wider whitespace-nowrap transition-all duration-200 active:scale-95 ${
                    activeFilter === pill
                      ? 'bg-white text-black shadow-[0_0_14px_rgba(255,255,255,0.3)]'
                      : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {pill}
                </button>
              ))}
            </div>
            {ytmFeed && (
              <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono text-zinc-600 flex-shrink-0">
                <RefreshCw className="w-2.5 h-2.5" />
                <span>{new Date(ytmFeed.fetchedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SEARCH RESULTS VIEW
      ════════════════════════════════════════════════════════════════════ */}
      {isSearchMode && (
        <div className="animate-zoneFadeInSubtle">
          {searchLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : searchResults ? (
            <SearchResults
              results={searchResults}
              resolvingIds={resolvingIds}
              currentTrackId={currentYtmId ?? currentTrackId}
              isPlaying={isPlaying}
              onPlayYtmTrack={handlePlayYtmTrack}
            />
          ) : null}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          DISCOVER VIEW (hidden when searching)
      ════════════════════════════════════════════════════════════════════ */}
      {!isSearchMode && (
        <>

          {/* ── SECTION 1: HERO SPOTLIGHT ─────────────────────────────────── */}
          {show('Vault Lossless') && featuredAlbums.length > 0 && (
            <section id="section-hero" className="animate-zoneFadeInSubtle">
              <div
                className={`relative w-full rounded-3xl overflow-hidden border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.9)] transition-all duration-500 ${heroAnimating ? 'opacity-60 scale-[0.99]' : 'opacity-100 scale-100'}`}
                style={{ minHeight: 280 }}
              >
                {currentHeroAlbum?.cover_url && (
                  <div className="absolute inset-0 scale-110 blur-3xl opacity-20 pointer-events-none" style={{ backgroundImage: `url(${currentHeroAlbum.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/30 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                {currentHeroAlbum?.cover_url && (
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-2/5 pointer-events-none">
                    <img src={currentHeroAlbum.cover_url} alt={currentHeroAlbum.title} className="w-full h-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />
                  </div>
                )}
                <div className="relative z-10 p-6 sm:p-10 flex flex-col justify-between" style={{ minHeight: 280 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-white text-black text-[9px] font-mono font-black tracking-widest">FEATURED</span>
                    {currentHeroAlbum?.tracks && (
                      <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white text-[9px] font-mono tracking-widest">{currentHeroAlbum.tracks.length} TRACKS</span>
                    )}
                    <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white text-[9px] font-mono tracking-widest">{currentHeroAlbum?.original_year ?? 'VAULT'}</span>
                  </div>
                  <div className="mt-auto pt-8">
                    <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5">{currentHeroAlbum?.artist ?? 'POSTLAIN'}</p>
                    <h2 className="text-2xl sm:text-4xl font-cyber font-black text-white uppercase leading-none tracking-tight mb-5 max-w-sm sm:max-w-xl">{currentHeroAlbum?.title ?? '—'}</h2>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button id="hero-play-all-btn" onClick={handlePlayAllHero} className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white text-black font-cyber font-black text-sm uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                        <Play className="w-4 h-4 fill-current" />PLAY ALL
                      </button>
                      <button onClick={() => currentHeroAlbum && onSelectAlbum?.(currentHeroAlbum)} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-mono text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95">
                        <ListMusic className="w-3.5 h-3.5" />VIEW ALBUM
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={() => navigateHero('prev')} aria-label="Previous" className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 text-white transition-all hover:scale-110 active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={() => navigateHero('next')} aria-label="Next" className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 text-white transition-all hover:scale-110 active:scale-90"><ChevronRight className="w-5 h-5" /></button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
                  {featuredAlbums.map((_, i) => (
                    <button key={i} onClick={() => setHeroIndex(i)} aria-label={`Slide ${i + 1}`} className={`rounded-full transition-all duration-300 ${i === heroIndex ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'}`} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── SECTION 2: V-HOP & V-R&B ──────────────────────────────────── */}
          {show('V-Hop & R&B') && (
            <section id="section-vhop" className="animate-zoneFadeInSubtle">
              <SectionHeader
                icon={<Music2 className="w-4 h-4" />}
                title="V-Hop & V-R&B"
                badge="CURATED"
                subtitle="MCK · Wren Evans · Low G · tlinh · Obito · 24k.Right"
                onScrollLeft={() => scrollLane('lane-vhop', 'left')}
                onScrollRight={() => scrollLane('lane-vhop', 'right')}
              />
              {ytmLoading ? (
                <div className="flex gap-3 overflow-x-hidden">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
              ) : curatedVhop.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 font-mono text-xs tracking-widest">LOADING CURATED FEED...</div>
              ) : (
                <div ref={(el) => { laneRefs.current['lane-vhop'] = el; }} id="lane-vhop" className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2">
                  {curatedVhop.map((track) => (
                    <YtmCompactCard
                      key={track.ytmId}
                      track={track}
                      isResolving={resolvingIds.has(track.ytmId)}
                      isCurrent={currentYtmId === track.ytmId || currentTrackId === track.ytmId}
                      isPlaying={isPlaying}
                      onPlay={() => handlePlayYtmTrack(track)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── SECTION 3: TRENDING QUICK PICKS ───────────────────────────── */}
          {show('V-Hop & R&B') && (
            <section id="section-trending" className="animate-zoneFadeInSubtle">
              <SectionHeader
                icon={<TrendingUp className="w-4 h-4" />}
                title="Trending Quick Picks"
                badge="VN CHARTS"
                subtitle="Top tracks đang hot tại Việt Nam"
                onScrollLeft={() => scrollLane('lane-trending', 'left')}
                onScrollRight={() => scrollLane('lane-trending', 'right')}
              />
              {ytmLoading ? (
                <div className="flex gap-3 overflow-x-hidden">{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : ytmTrending.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 font-mono text-xs tracking-widest">TRENDING DATA UNAVAILABLE</div>
              ) : (
                <div ref={(el) => { laneRefs.current['lane-trending'] = el; }} id="lane-trending" className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2">
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {ytmTrending.slice(0, Math.ceil(ytmTrending.length / 2)).map((track, i) => (
                      <YtmTrackRow
                        key={track.ytmId}
                        track={track}
                        rank={i + 1}
                        isResolving={resolvingIds.has(track.ytmId)}
                        isCurrent={currentYtmId === track.ytmId || currentTrackId === track.ytmId}
                        isPlaying={isPlaying}
                        onPlay={() => handlePlayYtmTrack(track)}
                      />
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {ytmTrending.slice(Math.ceil(ytmTrending.length / 2)).map((track, i) => (
                      <YtmTrackRow
                        key={track.ytmId}
                        track={track}
                        rank={Math.ceil(ytmTrending.length / 2) + i + 1}
                        isResolving={resolvingIds.has(track.ytmId)}
                        isCurrent={currentYtmId === track.ytmId || currentTrackId === track.ytmId}
                        isPlaying={isPlaying}
                        onPlay={() => handlePlayYtmTrack(track)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── SECTION 4: GLOBAL HITS ─────────────────────────────────────── */}
          {show('Global Hits') && (
            <section id="section-global" className="animate-zoneFadeInSubtle">
              <SectionHeader
                icon={<Globe className="w-4 h-4" />}
                title="Global Hits"
                badge="TRAP / MELODIC"
                subtitle="Travis Scott · The Weeknd · Metro Boomin · Playboi Carti"
                onScrollLeft={() => scrollLane('lane-global', 'left')}
                onScrollRight={() => scrollLane('lane-global', 'right')}
              />
              {ytmLoading ? (
                <div className="flex gap-3 overflow-x-hidden">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
              ) : curatedGlobal.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 font-mono text-xs tracking-widest">LOADING GLOBAL FEED...</div>
              ) : (
                <div ref={(el) => { laneRefs.current['lane-global'] = el; }} id="lane-global" className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2">
                  {curatedGlobal.map((track) => (
                    <YtmCompactCard
                      key={track.ytmId}
                      track={track}
                      isResolving={resolvingIds.has(track.ytmId)}
                      isCurrent={currentYtmId === track.ytmId || currentTrackId === track.ytmId}
                      isPlaying={isPlaying}
                      onPlay={() => handlePlayYtmTrack(track)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── SECTION 5: LO-FI / LATE-NIGHT CHILL ──────────────────────── */}
          {show('Lo-fi / Chill') && (
            <section id="section-lofi" className="animate-zoneFadeInSubtle">
              <SectionHeader
                icon={<Moon className="w-4 h-4" />}
                title="Lo-fi / Late-Night Chill"
                badge="MOOD"
                subtitle="Chillwave · Lo-fi Hip-hop · Late Night R&B"
                onScrollLeft={() => scrollLane('lane-lofi', 'left')}
                onScrollRight={() => scrollLane('lane-lofi', 'right')}
              />
              {ytmLoading ? (
                <div className="flex gap-3 overflow-x-hidden">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
              ) : curatedLofi.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 font-mono text-xs tracking-widest">LOADING MOOD FEED...</div>
              ) : (
                <div ref={(el) => { laneRefs.current['lane-lofi'] = el; }} id="lane-lofi" className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2">
                  {curatedLofi.map((track) => (
                    <YtmCompactCard
                      key={track.ytmId}
                      track={track}
                      isResolving={resolvingIds.has(track.ytmId)}
                      isCurrent={currentYtmId === track.ytmId || currentTrackId === track.ytmId}
                      isPlaying={isPlaying}
                      onPlay={() => handlePlayYtmTrack(track)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── SECTION 6: NEW RELEASES GRID ──────────────────────────────── */}
          {show('New Releases') && (
            <section id="section-new-releases" className="animate-zoneFadeInSubtle">
              <SectionHeader
                icon={<Sparkles className="w-4 h-4" />}
                title="New Releases"
                badge="YTM VN"
                subtitle="Album & Single mới nhất từ YouTube Music Việt Nam"
              />
              {ytmLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => <SkeletonGridCard key={i} />)}
                </div>
              ) : ytmNewReleases.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 font-mono text-xs tracking-widest">NEW RELEASES UNAVAILABLE</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {ytmNewReleases.map((album) => (
                    <YtmAlbumCard key={album.ytmId} album={album} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── SECTION 7: MOOD PLAYLISTS ─────────────────────────────────── */}
          {show('Lo-fi / Chill') && ytmMoodPlaylists.length > 0 && (
            <section id="section-mood-playlists" className="animate-zoneFadeInSubtle">
              <SectionHeader
                icon={<Radio className="w-4 h-4" />}
                title="Mood & Genre Playlists"
                badge="YTM"
                subtitle="Curated playlists for every vibe"
                onScrollLeft={() => scrollLane('lane-moods', 'left')}
                onScrollRight={() => scrollLane('lane-moods', 'right')}
              />
              <div ref={(el) => { laneRefs.current['lane-moods'] = el; }} id="lane-moods" className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2">
                {ytmMoodPlaylists.map((playlist, i) => (
                  <MoodPlaylistCard key={playlist.ytmId} playlist={playlist} gradient={MOOD_GRADIENTS[i % MOOD_GRADIENTS.length]} />
                ))}
              </div>
            </section>
          )}

          {/* ── SECTION 8: VAULT LOSSLESS ─────────────────────────────────── */}
          {show('Vault Lossless') && vaultTracks.length > 0 && (
            <section id="section-vault" className="animate-zoneFadeInSubtle">
              <SectionHeader
                icon={<Disc3 className="w-4 h-4" />}
                title="Hidden Vault"
                badge="LOSSLESS"
                subtitle="Bản thu âm lossless độc quyền — phát trực tiếp"
                onScrollLeft={() => scrollLane('lane-vault', 'left')}
                onScrollRight={() => scrollLane('lane-vault', 'right')}
              />
              <div ref={(el) => { laneRefs.current['lane-vault'] = el; }} id="lane-vault" className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2">
                {vaultTracks.map(({ track, album }, index) => {
                  const isCur = currentTrackId === track.id;
                  const isLiked = likedTrackIds.has(track.id);
                  const isAdded = addedQueueIds.has(track.id);
                  return (
                    <div
                      key={track.id || index}
                      id={`vault-track-${track.id}`}
                      onClick={() => handlePlayVaultTrack(track, album, 'vault_lossless_lane')}
                      className={`group relative w-44 sm:w-52 flex-shrink-0 snap-start rounded-2xl overflow-hidden bg-zinc-950 border transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-95 ${
                        isCur ? 'border-white ring-1 ring-white/40 shadow-[0_0_20px_rgba(255,255,255,0.10)]' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="relative w-full aspect-square bg-zinc-900">
                        {album.cover_url ? (
                          <img src={album.cover_url} alt={track.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Disc3 className="w-12 h-12 text-zinc-700" /></div>
                        )}
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5">
                          <button onClick={(e) => handleAddToQueue(track, e)} aria-label="Add to queue" className="p-2.5 rounded-full bg-black/80 hover:bg-white text-white hover:text-black border border-white/20 transition-all shadow-lg hover:scale-110 active:scale-90">
                            {isAdded ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Plus className="w-3.5 h-3.5" />}
                          </button>
                          <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.7)]">
                            {isCur && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                          </div>
                          <button onClick={(e) => handleLike(track.id, e, album.id)} aria-label={isLiked ? 'Unlike' : 'Like'} className={`p-2.5 rounded-full border transition-all shadow-lg hover:scale-110 active:scale-90 ${isLiked ? 'bg-white text-black border-white' : 'bg-black/80 text-white hover:bg-white hover:text-black border-white/20'}`}>
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                        {isCur && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white text-black text-[8px] font-mono font-black tracking-widest flex items-center gap-1">
                            <Disc3 className="w-2.5 h-2.5 animate-spin" />NOW
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-[8px] font-mono text-zinc-300 font-black">LOSSLESS</div>
                      </div>
                      <div className="p-3">
                        <h4 className="text-[11px] font-cyber font-extrabold text-white truncate uppercase leading-tight">{track.title}</h4>
                        <p className="text-[10px] font-mono text-zinc-500 truncate mt-0.5 uppercase">{track.artist ?? album.artist}</p>
                        {track.duration > 0 && (
                          <p className="text-[9px] font-mono text-zinc-600 mt-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{formatDuration(track.duration)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </>
      )}
    </div>
  );
}
