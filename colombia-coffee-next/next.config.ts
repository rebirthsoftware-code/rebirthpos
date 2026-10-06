import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Bu klasör üst dizindeki başka bir projenin içinde durduğu için kökü açıkça belirt
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Vercel Blob'dan gelen görseller düz <img> ile gösterilir (önizlemeler zaten istemcide küçültülüyor)
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: '1mb' },
  },
};

export default nextConfig;
