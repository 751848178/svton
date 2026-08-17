/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const cleanE2eCapture = process.env.SVTON_E2E_VISUAL_CAPTURE === '1';
const staticExport = process.env.SVTON_STATIC_EXPORT === '1';
const staticLocale = process.env.SVTON_STATIC_EXPORT_LOCALE;

if (staticExport && staticLocale !== 'zh' && staticLocale !== 'en') {
  throw new Error('SVTON_STATIC_EXPORT_LOCALE must be zh or en when SVTON_STATIC_EXPORT=1');
}

const nextConfig = {
  reactStrictMode: true,
  ...(staticExport ? {
    output: 'export',
    basePath: isProd ? '/svton/demo' : '',
    assetPrefix: isProd ? '/svton/demo/' : '',
    images: { unoptimized: true },
  } : {}),
  ...(cleanE2eCapture ? { devIndicators: false } : {}),
  typescript: {
    tsconfigPath: staticExport ? 'tsconfig.static.json' : 'tsconfig.json',
  },
};

module.exports = nextConfig;
