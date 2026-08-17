import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const consumerReact = (file: string) => fileURLToPath(
  new URL(`./node_modules/react/${file}`, import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@svton\/ui\/i18n$/,
        replacement: fileURLToPath(new URL('../ui/src/i18n/server.ts', import.meta.url)),
      },
      {
        find: /^@svton\/ui$/,
        replacement: fileURLToPath(new URL('../ui/src/index.ts', import.meta.url)),
      },
      {
        find: /^lucide-react$/,
        replacement: fileURLToPath(
          new URL('../ui/node_modules/lucide-react/dist/esm/lucide-react.mjs', import.meta.url),
        ),
      },
      { find: 'react/jsx-dev-runtime', replacement: consumerReact('jsx-dev-runtime.js') },
      { find: 'react/jsx-runtime', replacement: consumerReact('jsx-runtime.js') },
      { find: /^react$/, replacement: consumerReact('index.js') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  ssr: {
    noExternal: ['lucide-react'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        inline: ['@svton/ui', 'lucide-react'],
      },
    },
  },
});
