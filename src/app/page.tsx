'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Disc3, ShieldAlert } from 'lucide-react';
import VaultScene from '@/components/3d/VaultScene';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import VaultGate from '@/components/ui/VaultGate';
import { createClient } from '@/lib/supabase/client';
import { Album } from '@/types/database';
import {
  getStoredUserSession,
  setStoredUserSession,
  getStoredAdminSession,
  clearAllStoredSessions,
  performLogout
} from '@/lib/authSession';

export default function Home() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);

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
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching albums from Supabase:', error);
        } else if (data && Array.isArray(data)) {
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

  const handleSelectAlbum = (album: Album) => {
    router.push(`/album/${album.id}`);
  };

  const handleLogout = async () => {
    await performLogout();
  };

  // 0. Initial SSR / Mount placeholder to guarantee zero hydration error
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

  // 2. User is Logged In -> Show 3D Vault & Albums Immediately
  return (
    <main className="relative min-h-screen w-full bg-[#090a0f] overflow-hidden select-none">
      {/* 3D Vertical Column of Real Albums with Full Color & 3D Tilt Hover */}
      {albums.length > 0 && (
        <VaultScene
          albums={albums}
          onSelectAlbum={handleSelectAlbum}
        />
      )}

      {/* Minimalist Monochrome Top Navbar */}
      <Navbar
        userEmail={userSession?.email}
        onLogout={handleLogout}
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

      {/* Futuristic Cyberpunk High-Tech Footer (Fixed on Home Page) */}
      <Footer isFixed={true} />
    </main>
  );
}
