'use client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import React from 'react';
import Navbar from '@/components/ui/Navbar';
import ProfileModal from '@/components/ui/ProfileModal';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-black text-white relative">
      <Navbar showBackButton title="HỒ SƠ CÁ NHÂN" />
      <ProfileModal isOpen={true} onClose={() => router.push('/')} />
    </main>
  );
}
