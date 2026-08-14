'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Disc3, ShieldAlert, Play, Pause, Shuffle, Music, Film } from 'lucide-react';
import VaultScene from '@/components/3d/VaultScene';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import VaultGate from '@/components/ui/VaultGate';
import { createClient } from '@/lib/supabase/client';
import { Album, TrackItem } from '@/types/database';
import { usePlayer } from '@/context/PlayerContext';
import {
  getStoredUserSession,
  setStoredUserSession,
  getStoredAdminSession,
  performLogout
} from '@/lib/authSession';

export default function Home() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);

  // Seamless Master-Detail View Orchestration States
  const [viewMode, setViewMode] = useState<'vault' | 'album'>('vault');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackItem | null>(null);
  const [isCoverHovered, setIsCoverHovered] = useState(false);
  const [animateSlide, setAnimateSlide] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    shuffleMode,
    toggleShuffle,
  } = usePlayer();

  useEffect(() => {
    setMounted(true);

    // 1. Immediately read cached session & albums on client mount (0ms)
    const session = getStoredUserSession();
    if (session) {
      setUserSession(session);
    }

    try {
      const cached = localStorage.getItem('hidden_vault_cached_albums');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAlbums(parsed);
          setIsLoadingAlbums(false);
        }
      }
    } catch {}

    const supabase = createClient();

    // Background auth verification with Supabase
    const initAuth = async () => {
      try {
        if (getStoredAdminSession()) {
          setUserSession({ email: 'admin@hiddenvault.com', id: 'admin-master-id', display_name: 'LUCIINGO1108' });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserSession(session.user);
          setStoredUserSession(session.user);
          if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (err) {
        console.warn('Auth session check error:', err);
      }
    };

    initAuth();

    // Safety timeout: Never hang in loading state for more than 3 seconds
    const timeoutTimer = setTimeout(() => {
      setIsLoadingAlbums(false);
    }, 3000);

    // Clean background fetch of albums from Supabase
    const fetchSupabaseAlbums = async () => {
      try {
        const { data, error } = await supabase
          .from('albums')
          .select('*, tracks(*)')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching albums from Supabase:', error);
        } else if (data && Array.isArray(data)) {
          // Sort tracks for each album
          data.forEach((alb) => {
            if (alb.tracks) {
              alb.tracks.sort((a: TrackItem, b: TrackItem) => {
                return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
              });
            }
          });
          setAlbums(data);
          try {
            localStorage.setItem('hidden_vault_cached_albums', JSON.stringify(data));
          } catch {}
        }
      } catch (err) {
        console.error('Error fetching albums from Supabase:', err);
      } finally {
        clearTimeout(timeoutTimer);
        setIsLoadingAlbums(false);
      }
    };

    fetchSupabaseAlbums();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserSession(session.user);
        setStoredUserSession(session.user);
        if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        if (!getStoredAdminSession()) {
          const stored = getStoredUserSession();
          if (!stored) {
            setUserSession(null);
          }
        }
      }
    });

    // Listen to custom session updates
    const handleCustomSessionChange = () => {
      const stored = getStoredUserSession();
      if (stored) {
        setUserSession(stored);
      }
    };

    window.addEventListener('vault_profile_updated', handleCustomSessionChange);
    window.addEventListener('vault_auth_change', handleCustomSessionChange);

    return () => {
      clearTimeout(timeoutTimer);
      subscription.unsubscribe();
      window.removeEventListener('vault_profile_updated', handleCustomSessionChange);
      window.removeEventListener('vault_auth_change', handleCustomSessionChange);
    };
  }, []);

  // Listen to Browser Back / Forward buttons for seamless history traversal
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/album/')) {
        const albumId = window.location.pathname.replace('/album/', '');
        const targetAlb = albums.find((a) => a.id === albumId);
        if (targetAlb) {
          handleSelectAlbum(targetAlb, false);
        }
      } else {
        handleBackToVault(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [albums]);

  // Handle Album Selection with Seamless 60FPS Morph Transition
  const handleSelectAlbum = async (album: Album, updateHistory = true) => {
    let fullAlbum = album;

    // Check if album needs tracks fetched
    if (!album.tracks || album.tracks.length === 0) {
      try {
        const cached = localStorage.getItem(`hidden_vault_album_cache_${album.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.tracks) fullAlbum = parsed;
        } else {
          const supabase = createClient();
          const { data } = await supabase
            .from('albums')
            .select('*, tracks(*)')
            .eq('id', album.id)
            .maybeSingle();
          if (data) {
            if (data.tracks) {
              data.tracks.sort((a: TrackItem, b: TrackItem) => {
                return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
              });
            }
            fullAlbum = data;
            try {
              localStorage.setItem(`hidden_vault_album_cache_${album.id}`, JSON.stringify(data));
            } catch {}
          }
        }
      } catch {}
    }

    setSelectedAlbum(fullAlbum);
    if (fullAlbum.tracks && fullAlbum.tracks.length > 0) {
      setSelectedTrack(fullAlbum.tracks[0]);
    }
    setViewMode('album');
    setIsExiting(false);

    if (updateHistory && typeof window !== 'undefined') {
      window.history.pushState({ view: 'album', albumId: album.id }, '', `/album/${album.id}`);
    }

    // Trigger smooth slide-in
    setAnimateSlide(false);
    setTimeout(() => {
      setAnimateSlide(true);
    }, 40);
  };

  // Handle Back to 3D Vault with Reverse Morph Transition
  const handleBackToVault = (updateHistory = true) => {
    setIsExiting(true);
    setAnimateSlide(false);

    setTimeout(() => {
      setViewMode('vault');
      setSelectedAlbum(null);
      setIsExiting(false);
      if (updateHistory && typeof window !== 'undefined') {
        window.history.pushState({ view: 'vault' }, '', '/');
      }
    }, 320);
  };

  const handleLogout = async () => {
    await performLogout();
  };

  const tracks = useMemo(() => selectedAlbum?.tracks || [], [selectedAlbum]);
  const isCurrentPlayingThisAlbum = currentTrack && tracks.some((t) => t.id === currentTrack.id);

  const handlePlayAlbum = () => {
    if (tracks.length > 0 && selectedAlbum) {
      const trackToPlay = selectedTrack || tracks[0];
      playTrack(trackToPlay, selectedAlbum, tracks);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length > 0 && selectedAlbum) {
      if (!shuffleMode) toggleShuffle();
      const randomIndex = Math.floor(Math.random() * tracks.length);
      playTrack(tracks[randomIndex], selectedAlbum, tracks);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '03:20';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 0. Initial SSR / Mount placeholder
  if (!mounted) {
    return (
      <main className="min-h-screen w-full bg-black flex items-center justify-center font-mono">
        <div className="tv-grain-overlay" />
        <div className="crt-scanlines" />
        <div className="flex items-center gap-3 text-slate-400">
          <Disc3 className="w-6 h-6 animate-spin text-white" />
          <span className="text-xs uppercase tracking-widest font-cyber">INITIALIZING VAULT...</span>
        </div>
      </main>
    );
  }

  // 1. Mandatory Login Screen before accessing 3D Vault
  if (!userSession) {
    return <VaultGate />;
  }

  // 2. User is Logged In -> Single Continuous Canvas
  return (
    <main className="relative h-[100dvh] w-full bg-[#090a0f] overflow-hidden select-none">
      
      {/* ========================================================================= */}
      {/* 1. VAULT VIEW: 3D Central Monolith of Real Albums                         */}
      {/* ========================================================================= */}
      {viewMode === 'vault' && albums.length > 0 && (
        <div className={`w-full h-full transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
          <VaultScene
            albums={albums}
            onSelectAlbum={handleSelectAlbum}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ALBUM DETAIL VIEW: 60FPS Shared-Element Morph Canvas                   */}
      {/* ========================================================================= */}
      {viewMode === 'album' && selectedAlbum && (
        <div className="relative w-full h-full flex flex-col justify-between overflow-hidden animate-fadeIn">
          {/* Dynamic Ambient Background Glow from Cover Art */}
          <div
            className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full pointer-events-none opacity-20 blur-[130px] transition-all duration-1000 z-0"
            style={{
              backgroundImage: `radial-gradient(circle, #ffffff 0%, #3b82f6 40%, #7c3aed 70%, transparent 100%)`,
            }}
          />

          {/* Main Single-Viewport Locked Content Area */}
          <div className="flex-1 min-h-0 w-full max-w-[1400px] mx-auto px-3 sm:px-6 md:px-8 lg:px-12 flex flex-col lg:flex-row items-center justify-center gap-3 sm:gap-6 lg:gap-12 overflow-hidden pt-14 sm:pt-16 pb-20 sm:pb-24">
            
            {/* LEFT COLUMN: 3D Vinyl Sleeve Showcase with Gliding Spring Physics */}
            <div
              className={`w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col items-center text-center space-y-2 sm:space-y-3 relative z-20 transition-all duration-700 ease-out max-h-[36vh] lg:max-h-none ${
                animateSlide && !isExiting
                  ? 'translate-x-0 opacity-100 scale-100'
                  : 'lg:translate-x-[200px] opacity-0 scale-95'
              }`}
            >
              {/* 3D Vinyl Sleeve Deck with Realistic Peek & Slide Out */}
              <div
                className="relative group cursor-pointer flex items-center justify-center overflow-visible"
                onMouseEnter={() => setIsCoverHovered(true)}
                onMouseLeave={() => setIsCoverHovered(false)}
                onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
              >
                {/* Outer Vinyl Disc Wrapper */}
                <div
                  id="album-vinyl-wrapper"
                  className={`absolute w-28 h-28 xs:w-36 xs:h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-60 lg:h-60 xl:w-68 xl:h-68 transition-all duration-700 ease-out z-0 pointer-events-none ${
                    (isCoverHovered || (isCurrentPlayingThisAlbum && isPlaying))
                      ? 'translate-x-10 sm:translate-x-18 md:translate-x-22 opacity-100'
                      : 'translate-x-0 opacity-0'
                  }`}
                >
                  <div
                    id="album-vinyl-disc"
                    className="w-full h-full rounded-full bg-[#0a0a0a] shadow-[0_15px_40px_rgba(0,0,0,0.9)] flex items-center justify-center will-change-transform"
                    style={{
                      background: 'radial-gradient(circle, #222 2%, #0d0d0d 15%, #181818 30%, #080808 45%, #151515 60%, #050505 85%, #000 100%)',
                    }}
                  >
                    <div className="absolute inset-2 rounded-full border border-white/[0.04]" />
                    <div className="absolute inset-5 rounded-full border border-white/[0.06]" />
                    <div className="absolute inset-10 rounded-full border border-white/[0.08]" />
                    <div className="absolute inset-14 rounded-full border border-white/[0.05]" />

                    {/* Central Label */}
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 md:w-18 md:h-18 rounded-full overflow-hidden shadow-inner flex items-center justify-center ${
                      isCurrentPlayingThisAlbum && isPlaying ? 'animate-spin-slow' : ''
                    }`}>
                      <img src={selectedAlbum.cover_url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute w-2 h-2 rounded-full bg-black" />
                    </div>
                  </div>
                </div>

                {/* Front Album Sleeve */}
                <div
                  id="album-cover-box"
                  className="relative w-28 h-28 xs:w-36 xs:h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-60 lg:h-60 xl:w-68 xl:h-68 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.95)] bg-zinc-950 flex-shrink-0 z-10 will-change-transform"
                >
                  <img
                    src={selectedAlbum.cover_url}
                    alt={selectedAlbum.title}
                    className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
                      isCurrentPlayingThisAlbum && isPlaying ? 'scale-[1.02]' : ''
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-white/10 opacity-70 group-hover:opacity-40 transition-opacity" />

                  {/* Floating Center Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-white/90 backdrop-blur-md text-black flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-all duration-300 group-hover:scale-110 group-hover:bg-white active:scale-95">
                      {isCurrentPlayingThisAlbum && isPlaying ? (
                        <Pause className="w-4 h-4 sm:w-6 sm:h-6 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 sm:w-6 sm:h-6 fill-current ml-0.5" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Artist */}
              <div className="space-y-0.5 px-2 w-full">
                <h1 className="text-sm xs:text-base sm:text-2xl lg:text-3xl font-black tracking-tight uppercase text-white font-cyber truncate drop-shadow-md">
                  {selectedAlbum.title}
                </h1>
                <p className="text-[10px] sm:text-xs font-mono text-slate-300 uppercase tracking-widest font-semibold truncate">
                  {selectedAlbum.artist}
                </p>
              </div>

              {/* Action Buttons Deck */}
              <div className="w-full max-w-xs flex items-center gap-2 pt-0.5">
                <button
                  onClick={isCurrentPlayingThisAlbum ? togglePlay : handlePlayAlbum}
                  className="flex-1 py-1.5 sm:py-2.5 px-3 sm:px-4 rounded-full bg-white hover:bg-slate-100 text-black font-black font-mono text-[10px] sm:text-xs uppercase tracking-wider shadow-[0_10px_30px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {isCurrentPlayingThisAlbum && isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>PAUSE</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>PLAY ALL</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleShufflePlay}
                  title={shuffleMode ? 'Tắt trộn bài' : 'Phát ngẫu nhiên'}
                  className={`p-1.5 sm:p-2.5 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center ${
                    shuffleMode
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Dark Neumorphic Playlist Panel with Smooth Staggered Reveal */}
            <div
              className={`flex-1 min-h-0 lg:flex-none w-full max-w-xl lg:max-w-2xl h-full lg:h-[480px] xl:h-[520px] max-h-[70vh] flex flex-col font-mono transition-all duration-700 delay-75 ease-out ${
                animateSlide && !isExiting
                  ? 'translate-x-0 opacity-100'
                  : 'translate-x-16 opacity-0 pointer-events-none'
              }`}
            >
              <div className="dark-neumorph-card p-2 sm:p-3 md:p-4 h-full flex flex-col w-full overflow-hidden shadow-2xl">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1 select-none no-scrollbar px-0.5 py-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {tracks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                      <Disc3 className="w-8 h-8 text-slate-600 animate-spin-slow mb-2" />
                      <p className="text-xs uppercase tracking-widest font-mono">
                        NO TRACKS IN THIS ARCHIVE
                      </p>
                    </div>
                  ) : (
                    tracks.map((track, idx) => {
                      const isCurrentPlaying = currentTrack?.id === track.id;
                      const trackIndex = String(idx + 1).padStart(2, '0');

                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            setSelectedTrack(track);
                            playTrack(track, selectedAlbum, tracks);
                          }}
                          className={`group relative h-13 sm:h-14 px-3.5 sm:px-4 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between border ${
                            isCurrentPlaying
                              ? 'bg-white/[0.10] border-white/25 shadow-[0_0_20px_rgba(255,255,255,0.06)]'
                              : 'bg-transparent hover:bg-white/[0.04] border-transparent hover:border-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-3">
                            <div className="w-6 flex items-center justify-center flex-shrink-0">
                              {isCurrentPlaying && isPlaying ? (
                                <div className="flex items-end gap-[2px] h-3.5">
                                  <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '70%', animationDelay: '0ms' }} />
                                  <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '100%', animationDelay: '150ms' }} />
                                  <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '85%', animationDelay: '300ms' }} />
                                </div>
                              ) : (
                                <>
                                  <span className={`text-xs font-mono font-bold group-hover:hidden ${
                                    isCurrentPlaying ? 'text-white font-black' : 'text-slate-500'
                                  }`}>
                                    {trackIndex}
                                  </span>
                                  <Play className="w-3.5 h-3.5 fill-white text-white hidden group-hover:block transition-all" />
                                </>
                              )}
                            </div>

                            <span className={`truncate text-xs sm:text-sm font-cyber tracking-wide ${
                              isCurrentPlaying ? 'text-white font-black' : 'text-slate-300 group-hover:text-white font-medium'
                            }`}>
                              {track.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
                            {track.video_url && (
                              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                                MV
                              </span>
                            )}

                            <span className={`text-[11px] sm:text-xs font-mono tabular-nums ${
                              isCurrentPlaying ? 'text-white font-bold' : 'text-slate-500 group-hover:text-slate-400'
                            }`}>
                              {formatDuration(track.duration)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Top Navbar with Dynamic State & Smooth Back Handler */}
      <Navbar
        userEmail={userSession?.email}
        onLogout={handleLogout}
        showBackButton={viewMode === 'album'}
        onBackClick={() => handleBackToVault(true)}
        title={viewMode === 'album' ? selectedAlbum?.title : undefined}
      />

      {/* Futuristic Spinner while Initial Albums are loading */}
      {isLoadingAlbums && albums.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10 text-center font-mono select-none">
          <div className="flex items-center gap-3 text-slate-400">
            <Disc3 className="w-8 h-8 animate-spin text-white" />
            <span className="text-xs uppercase tracking-widest font-cyber">DECRYPTING 3D VAULT ARCHIVE...</span>
          </div>
        </div>
      )}

      {/* Secure Empty State ONLY when fetch completed and no albums exist */}
      {!isLoadingAlbums && albums.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10 text-center font-mono select-none">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white uppercase tracking-widest mb-2 font-cyber">
            KHO LƯU TRỮ CHƯA CÓ BẢN GHI
          </h2>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Hệ thống đang bảo mật các bản ghi âm nhạc. Vui lòng quay lại sau.
          </p>
        </div>
      )}

      {/* Footer (Hidden on mobile if fixed) */}
      <Footer isFixed={true} />
    </main>
  );
}
