'use client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import React from 'react';
import Navbar from '@/components/ui/Navbar';
import SettingsModal from '@/components/ui/SettingsModal';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-black text-white relative">
      <Navbar showBackButton title="CÀI ĐẶT TRÌNH PHÁT" />
      <SettingsModal isOpen={true} onClose={() => router.push('/')} />
    </main>
  );
}
