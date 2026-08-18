import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { PlayerProvider } from '@/context/PlayerContext';
import GlobalPlayerBar from '@/components/ui/GlobalPlayerBar';
import CinematicVisualizer from '@/components/ui/CinematicVisualizer';
import ShortcutsDrawer from '@/components/ui/ShortcutsDrawer';
import Script from 'next/script';

const outfit = Outfit({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-outfit',
});

const dfvnGrafika = localFont({
  src: '../../public/fonts/DFVN-Grafika.otf',
  variable: '--font-dfvn-grafika',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Hidden Music Vault | Kho Âm Nhạc Bị Ẩn & Thu Hồi 3D',
  description: 'Trải nghiệm không gian 3D đẳng cấp thế giới lưu trữ và phát trực tuyến các sản phẩm âm nhạc bị cấm, bị ẩn hoặc chưa từng phát hành.',
  keywords: ['Hidden Music', '3D Vault', 'Web Audio 3D', 'Unreleased Music', 'Supabase', 'Vercel'],
  authors: [{ name: 'Hidden Vault Team' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hidden Music',
  },
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
    <html lang="vi" className={`${outfit.variable} ${dfvnGrafika.variable} dark`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black text-white antialiased selection:bg-white selection:text-black overflow-x-hidden">
        <PlayerProvider>
          <div id="cinematic-viewport-wrapper" className="min-h-screen w-full transition-transform duration-75 ease-out">
            {children}
          </div>
          <CinematicVisualizer />
          <GlobalPlayerBar />
          <ShortcutsDrawer />
        </PlayerProvider>

        {/* Script tự động đăng ký Service Worker để kích hoạt nút Cài đặt ứng dụng (PWA) */}
        <Script
          id="register-service-worker"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.log('SW registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
