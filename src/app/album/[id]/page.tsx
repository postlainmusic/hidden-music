'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import VaultApp from '@/components/VaultApp';

export const runtime = 'edge';

export default function AlbumDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return <VaultApp initialAlbumId={id} />;
}
