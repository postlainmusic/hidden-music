'use client';

/**
 * 3D Vault Page (/vault) — POSTLAIN Monolith Master Studio Stage
 *
 * 21st.dev Style Audiophile Space:
 *  - 3D Monolith Vinyl Stage & Interactive Sleeve Slide-out
 *  - Halo Kinetic Audio Visualizer reacting to dynamic sound
 *  - Master Studio 24-bit FLAC HUD & Side Comments Deck
 */

import React from 'react';
import VaultApp from '@/components/VaultApp';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default function VaultPage() {
  return <VaultApp />;
}
