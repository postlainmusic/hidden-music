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

export default function Home() {
  const router = useRouter();

  // Lazy state initializer using sessionStorage & localStorage for tab-level session persistence across F5
  const [userSession, setUserSession] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('hidden_vault_user_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.email || parsed.id)) return parsed;
        }
        const isAdminSession = sessionStorage.getItem('hidden_vault_admin_session') === 'true' ||
          document.cookie.includes('hidden_vault_admin=true');
        if (isAdminSession) {
          return { email: 'admin@hiddenvault.com', id: 'admin-master-id' };
        }
        const hasSupabaseAuth = Object.keys(localStorage).some((k) => k.includes('sb-') || k.includes('auth-token'));
        if (hasSupabaseAuth) {
          return { email: 'member@hiddenvault.com', id: 'vault-active-user' };
        }
      } catch (err) {
        console.warn('Session parse note:', err);
      }
    }
    return null;
  });

  const [albums, setAlbums] = useState<Album[]>([]);

  useEffect(() => {
    const supabase = createClient();

    // Background auth verification with Supabase
    const initAuth = async () => {
      try {
        const isAdminSession = sessionStorage.getItem('hidden_vault_admin_session') === 'true' ||
          document.cookie.includes('hidden_vault_admin=true');
        if (isAdminSession) {
          setUserSession({ email: 'admin@hiddenvault.com', id: 'admin-master-id' });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserSession(session.user);
          sessionStorage.setItem('hidden_vault_user_session', JSON.stringify(session.user));
          if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (err) {
        console.warn('Auth session check error:', err);
      }
    };

    initAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserSession(session.user);
        sessionStorage.setItem('hidden_vault_user_session', JSON.stringify(session.user));
        if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        const isAdminSession = sessionStorage.getItem('hidden_vault_admin_session') === 'true' ||
          document.cookie.includes('hidden_vault_admin=true');
        if (!isAdminSession) {
          sessionStorage.removeItem('hidden_vault_user_session');
          setUserSession(null);
        }
      }
    });

    // Clean background fetch of albums from Supabase
    const fetchSupabaseAlbums = async () => {
      try {
        const { data } = await supabase
          .from('albums')
          .select('*')
          .order('created_at', { ascending: false });

        if (data && Array.isArray(data) && data.length > 0) {
          setAlbums(data);
        }
      } catch (err) {
        console.error('Error fetching albums from Supabase:', err);
      }
    };

    fetchSupabaseAlbums();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSelectAlbum = (album: Album) => {
    router.push(`/album/${album.id}`);
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      sessionStorage.clear();
      document.cookie = "hidden_vault_admin=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      setUserSession(null);
      window.location.href = '/';
    }
  };

  // 1. Mandatory Login Screen before accessing 3D Vault
  if (!userSession) {
    return <VaultGate />;
  }

  // 2. User is Logged In -> Show 3D Vault & Albums Immediately
  return (
    <main className="relative min-h-screen w-full bg-black overflow-hidden select-none">
      {/* Analog TV Grain Noise & CRT Scanlines Overlays */}
      <div className="tv-grain-overlay" />
      <div className="crt-scanlines" />

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

      {/* Secure Empty State when no albums exist */}
      {albums.length === 0 && (
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
