import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // نستورد حزمة العمل المشتركة كمصدر TypeScript مباشرة بلا خطوة بناء وسيطة
  transpilePackages: ['@arabic-v2t/core'],
  eslint: { ignoreDuringBuilds: true },

  webpack: (config) => {
    // حزمة core تكتب استيراداتها بلاحقة `.js` كما يوجب ESM، لكن الملفات على
    // القرص `.ts`. هذا يخبر webpack أن يجرّب مصدر TypeScript لكل `.js`،
    // فنستورد الحزمة كمصدر مباشرة بلا خطوة بناء وسيطة.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

export default nextConfig
