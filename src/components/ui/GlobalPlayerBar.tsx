'use client';

import React, { useState, useEffect } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { hasActiveSession } from '@/lib/authSession';
import DesktopPlayerBar from '@/components/ui/player/DesktopPlayerBar';
import MobilePlayerBar from '@/components/ui/player/MobilePlayerBar';

export default function GlobalPlayerBar() {
  const { currentTrack, activeZone } = usePlayer();
  const [mounted, setMounted] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsAuth(hasActiveSession());

    const handleAuthChange = () => {
      setIsAuth(hasActiveSession());
    };

    window.addEventListener('vault_auth_change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('vault_auth_change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  // =========================================================================
  // 1. AUTO-HIDE IN VIDEO ZONE (0% Footprint when watching MV / Movie)
  // =========================================================================
  if (activeZone === 'video') {
    return null;
  }

  // =========================================================================
  // 2. AUTH & TRACK VALIDATION GATE
  // =========================================================================
  if (!mounted || !isAuth || !currentTrack) {
    return null;
  }

  return (
    <>
      {/* DESKTOP VIEWPORT: md and above */}
      <div className="hidden md:contents">
        <DesktopPlayerBar />
      </div>

      {/* MOBILE VIEWPORT: below md */}
      <div className="block md:hidden">
        <MobilePlayerBar />
      </div>
    </>
  );
}
