/** @type {import('next').NextConfig} */
const apiPort = Number(process.env.SHIPKIT_API_PORT ?? '8770');
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) throw new Error('Invalid SHIPKIT_API_PORT');
const config = {
  distDir: process.env.SHIPKIT_WEB_BUILD_DIR ?? '.next',
  transpilePackages: ['@svton/ui', '@svton/hooks', '@svton/api-client'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `http://127.0.0.1:${apiPort}/api/:path*` }];
  },
};
export default config;
