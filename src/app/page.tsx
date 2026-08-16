'use client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import React from 'react';
import VaultApp from '@/components/VaultApp';

export default function Home() {
  return <VaultApp />;
}
