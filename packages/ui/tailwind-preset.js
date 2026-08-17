const path = require('path');

const semanticColor = (name) => `rgb(from var(--svton-ui-${name}) r g b / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(path.dirname(require.resolve('@svton/ui')), '**/*.{js,mjs}'),
  ],
  theme: {
    extend: {
      colors: {
        background: semanticColor('background'),
        foreground: semanticColor('foreground'),
        card: {
          DEFAULT: semanticColor('surface'),
          foreground: semanticColor('foreground'),
        },
        popover: {
          DEFAULT: semanticColor('surface-overlay'),
          foreground: semanticColor('foreground'),
        },
        primary: {
          DEFAULT: semanticColor('control-primary'),
          foreground: semanticColor('control-primary-foreground'),
        },
        secondary: {
          DEFAULT: semanticColor('control-secondary'),
          foreground: semanticColor('foreground'),
        },
        muted: {
          DEFAULT: semanticColor('surface-muted'),
          foreground: semanticColor('text-muted'),
        },
        accent: {
          DEFAULT: semanticColor('surface-raised'),
          foreground: semanticColor('foreground'),
        },
        destructive: {
          DEFAULT: semanticColor('status-error'),
          foreground: semanticColor('status-on-color'),
        },
        border: semanticColor('border'),
        input: semanticColor('border-control'),
        ring: semanticColor('focus-ring'),
        status: {
          success: semanticColor('status-success'),
          warning: semanticColor('status-warning'),
          error: semanticColor('status-error'),
          info: semanticColor('status-info'),
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
};
