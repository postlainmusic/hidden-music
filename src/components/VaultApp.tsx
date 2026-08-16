'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Disc3, ShieldAlert } from 'lucide-react';
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

interface VaultAppProps {
  initialAlbumId?: string;
}

export default function VaultApp({ initialAlbumId }: VaultAppProps) {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);

  // Seamless Master-Detail View Orchestration States
  const [viewMode, setViewMode] = useState<'vault' | 'album'>(initialAlbumId ? 'album' : 'vault');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackItem | null>(null);

  // Dynamic Maintenance Estimated Time (+2 hours from viewing)
  const [maintenanceTime, setMaintenanceTime] = useState<{ timeStr: string; fullStr: string }>({
    timeStr: '',
    fullStr: '',
  });

  useEffect(() => {
    const updateMaintenanceTarget = () => {
      const target = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const hours = String(target.getHours()).padStart(2, '0');
      const minutes = String(target.getMinutes()).padStart(2, '0');
      const day = String(target.getDate()).padStart(2, '0');
      const month = String(target.getMonth() + 1).padStart(2, '0');
      const year = target.getFullYear();

      setMaintenanceTime({
        timeStr: `${hours}:${minutes}`,
        fullStr: `${hours}:${minutes} (${day}/${month}/${year})`,
      });
    };

    updateMaintenanceTarget();
    const interval = setInterval(updateMaintenanceTarget, 60000);
    return () => clearInterval(interval);
  }, []);

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

    const effectiveAlbumId = initialAlbumId || (typeof window !== 'undefined' && window.location.pathname.startsWith('/album/') ? window.location.pathname.replace('/album/', '') : '');
    if (effectiveAlbumId) {
      setViewMode('album');
      try {
        const singleCached = localStorage.getItem(`hidden_vault_album_cache_${effectiveAlbumId}`);
        if (singleCached) {
          const parsed = JSON.parse(singleCached);
          if (parsed && parsed.id) {
            setSelectedAlbum(parsed);
            if (parsed.tracks && parsed.tracks.length > 0) {
              setSelectedTrack(parsed.tracks[0]);
            }
          }
        }
      } catch {}
    }

    try {
      const cached = localStorage.getItem('hidden_vault_cached_albums');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAlbums(parsed);
          setIsLoadingAlbums(false);
          if (effectiveAlbumId && !selectedAlbum) {
            const match = parsed.find((a: Album) => a.id === effectiveAlbumId);
            if (match) {
              setSelectedAlbum(match);
              if (match.tracks && match.tracks.length > 0) {
                setSelectedTrack(match.tracks[0]);
              }
            }
          }
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

          if (effectiveAlbumId) {
            const match = data.find((a: Album) => a.id === effectiveAlbumId);
            if (match) {
              setSelectedAlbum(match);
              if (match.tracks && match.tracks.length > 0) {
                setSelectedTrack(match.tracks[0]);
              }
            }
          }
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
      setUserSession(stored);
    };

    window.addEventListener('vault_profile_updated', handleCustomSessionChange);
    window.addEventListener('vault_auth_change', handleCustomSessionChange);

    return () => {
      clearTimeout(timeoutTimer);
      subscription.unsubscribe();
      window.removeEventListener('vault_profile_updated', handleCustomSessionChange);
      window.removeEventListener('vault_auth_change', handleCustomSessionChange);
    };
  }, [initialAlbumId]);

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

  // Handle Album Selection with Smooth 60FPS Morph Transition
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

    if (updateHistory && typeof window !== 'undefined') {
      window.history.pushState({ view: 'album', albumId: album.id }, '', `/album/${album.id}`);
    }
  };

  // Handle Back to 3D Vault with Smooth Reverse Glide (Zero Glitch)
  const handleBackToVault = (updateHistory = true) => {
    setViewMode('vault');
    if (updateHistory && typeof window !== 'undefined') {
      window.history.pushState({ view: 'vault' }, '', '/');
    }
  };

  const handleLogout = async () => {
    setUserSession(null);
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
      
      {/* Unified Continuous Stage with 60FPS Physical Glide */}
      {albums.length > 0 && (
        <VaultScene
          albums={albums}
          viewMode={viewMode}
          selectedAlbum={selectedAlbum}
          onSelectAlbum={handleSelectAlbum}
          tracks={tracks}
          selectedTrack={selectedTrack}
          setSelectedTrack={setSelectedTrack}
          currentTrack={currentTrack}
          isCurrentPlayingThisAlbum={Boolean(isCurrentPlayingThisAlbum)}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          playTrack={playTrack}
          shuffleMode={shuffleMode}
          toggleShuffle={toggleShuffle}
          handlePlayAlbum={handlePlayAlbum}
          handleShufflePlay={handleShufflePlay}
          formatDuration={formatDuration}
        />
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

      {/* Secure Empty State / Maintenance Mode when no albums exist */}
      {!isLoadingAlbums && albums.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10 text-center font-mono select-none">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
            <ShieldAlert className="w-8 h-8 text-white/80 animate-pulse" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] text-slate-300 font-bold uppercase tracking-widest mb-3">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            HỆ THỐNG ĐANG BẢO TRÌ
          </div>
          <h2 className="text-base sm:text-xl font-extrabold text-white uppercase tracking-wider mb-2 font-cyber max-w-lg">
            HỆ THỐNG ĐANG BẢO TRÌ VÀ NÂNG CẤP DỮ LIỆU
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed">
            Hệ thống sẽ bảo trì đến khoảng <span className="text-white font-bold tracking-wide underline underline-offset-4">{maintenanceTime.fullStr || '2 tiếng nữa'}</span>, vui lòng quay lại sau <span className="text-white font-bold tracking-wide underline underline-offset-4">{maintenanceTime.timeStr || '2 tiếng nữa'}</span>.
          </p>
          <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-500 font-cyber">
            <span>SECURE VAULT GATEWAY</span>
            <span>•</span>
            <span>MAINTENANCE WINDOW ACTIVE</span>
          </div>
        </div>
      )}

      {/* Footer (Hidden on mobile if fixed) */}
      <Footer isFixed={true} />
    </main>
  );
}
