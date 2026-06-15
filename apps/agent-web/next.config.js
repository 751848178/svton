/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // When deployed under /svton/demo/ on GitHub Pages
  basePath: isProd ? '/svton/demo' : '',
  assetPrefix: isProd ? '/svton/demo/' : '',
  images: { unoptimized: true },
};

module.exports = nextConfig;
