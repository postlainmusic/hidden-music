'use client';

import React from 'react';
import { PlayerProvider } from '@/context/PlayerContext';
import GlobalPlayerBar from '@/components/ui/GlobalPlayerBar';
import CinematicVisualizer from '@/components/ui/CinematicVisualizer';
import ShortcutsDrawer from '@/components/ui/ShortcutsDrawer';

interface GlobalPlayerIslandProps {
  children?: React.ReactNode;
}

export default function GlobalPlayerIsland({ children }: GlobalPlayerIslandProps) {
  return (
    <PlayerProvider>
      {children}
      <CinematicVisualizer />
      <GlobalPlayerBar />
      <ShortcutsDrawer />
    </PlayerProvider>
  );
}
