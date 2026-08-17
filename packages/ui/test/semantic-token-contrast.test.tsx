import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8');
const dark = css.match(/:root\s*\{([^}]+)\}/s)?.[1] ?? '';
const light = css.match(/:root\[data-theme='light'\],\s*:root\.light\s*\{([^}]+)\}/s)?.[1] ?? '';
const themes = [['dark', dark], ['light', light]] as const;

function token(theme: string, name: string): string {
  const value = theme.match(new RegExp(`--svton-ui-${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  if (!value) throw new Error(`Missing semantic token: ${name}`);
  return value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('semantic control tokens', () => {
  describe.each(themes)('%s theme', (_name, theme) => {
    it.each(['surface', 'surface-overlay', 'surface-muted'])('keeps control borders >= 3:1 on %s', (surface) => {
      expect(contrast(token(theme, 'border-control'), token(theme, surface))).toBeGreaterThanOrEqual(3);
    });

    it.each(['surface', 'surface-overlay', 'surface-muted'])('keeps keyboard focus >= 3:1 on %s', (surface) => {
      expect(contrast(token(theme, 'focus-ring'), token(theme, surface))).toBeGreaterThanOrEqual(3);
    });

    it.each(['background', 'surface', 'surface-muted'])('keeps muted text >= 4.5:1 on %s', (surface) => {
      expect(contrast(token(theme, 'text-muted'), token(theme, surface))).toBeGreaterThanOrEqual(4.5);
    });

    it.each(['background', 'surface', 'surface-muted'])('keeps foreground text >= 4.5:1 on %s', (surface) => {
      expect(contrast(token(theme, 'foreground'), token(theme, surface))).toBeGreaterThanOrEqual(4.5);
    });

    it.each(['status-success', 'status-warning', 'status-error', 'status-info'])('%s remains readable on transcript surfaces', (status) => {
      for (const surface of ['background', 'surface', 'surface-muted']) {
        expect(contrast(token(theme, status), token(theme, surface))).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('keeps primary control text >= 4.5:1', () => {
      expect(contrast(token(theme, 'control-primary-foreground'), token(theme, 'control-primary')))
        .toBeGreaterThanOrEqual(4.5);
    });
  });
});
