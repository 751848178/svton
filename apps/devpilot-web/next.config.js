const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const c5DistDir = process.env.DEVPILOT_NEXT_DIST_DIR;

if (c5DistDir && !/^\.next\/c5-[a-f0-9]{8}-[a-f0-9]{32}\/dist$/.test(c5DistDir)) {
  throw new Error('DEVPILOT_NEXT_DIST_DIR_INVALID');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@svton/ui', '@svton/hooks'],
  ...(c5DistDir ? { distDir: c5DistDir } : {}),
};

module.exports = withNextIntl(nextConfig);
