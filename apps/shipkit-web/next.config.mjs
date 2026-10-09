/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@svton/ui', '@svton/hooks', '@svton/api-client'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://127.0.0.1:8770/api/:path*' }];
  },
};
export default config;
