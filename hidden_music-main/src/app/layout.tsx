import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { PlayerProvider } from '@/context/PlayerContext';
import GlobalPlayerBar from '@/components/ui/GlobalPlayerBar';
import CinematicVisualizer from '@/components/ui/CinematicVisualizer';

const outfit = Outfit({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'Hidden Music Vault | Kho Âm Nhạc Bị Ẩn & Thu Hồi 3D',
  description: 'Trải nghiệm không gian 3D đẳng cấp thế giới lưu trữ và phát trực tuyến các sản phẩm âm nhạc bị cấm, bị ẩn hoặc chưa từng phát hành.',
  keywords: ['Hidden Music', '3D Vault', 'Web Audio 3D', 'Unreleased Music', 'Supabase', 'Vercel'],
  authors: [{ name: 'Hidden Vault Team' }],
  openGraph: {
    title: 'Hidden Music Vault | Kho Âm Nhạc 3D Tối Mật',
    description: 'Nền tảng phát nhạc 3D tương tác theo thời gian thực dành cho các bản nhạc bị cấm & thu hồi.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${outfit.variable} dark`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#030509] text-slate-100 antialiased selection:bg-cyan-500 selection:text-black overflow-x-hidden">
        <PlayerProvider>
          <div id="cinematic-viewport-wrapper" className="min-h-screen w-full transition-transform duration-75 ease-out">
            {children}
          </div>
          <CinematicVisualizer />
          <GlobalPlayerBar />
        </PlayerProvider>
      </body>
    </html>
  );
}
