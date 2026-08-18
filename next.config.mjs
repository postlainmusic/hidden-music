/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  typescript: {
    // Bỏ qua typecheck lúc build CI để tăng tốc 3-4 lần
    ignoreBuildErrors: true,
  },
  eslint: {
    // Bỏ qua lint lúc build CI
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
