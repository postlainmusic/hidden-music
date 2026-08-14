'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Home from '@/app/page';

export default function AlbumDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return <Home initialAlbumId={id} />;
}
