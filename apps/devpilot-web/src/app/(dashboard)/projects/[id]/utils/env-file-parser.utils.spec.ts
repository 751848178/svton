import { describe, expect, it } from 'vitest';
import {
  isSensitiveEnvKey,
  parseEnvText,
} from './env-file-parser.utils';

describe('parseEnvText (F447 AC-SET-035)', () => {
  it('parses KEY=VALUE lines, strips quotes and inline comments, skips comments/blank lines', () => {
    const result = parseEnvText(`
# comment
NODE_ENV=production
PORT = 3000
QUOTED="hello world"
INLINE=value # trailing
`);
    expect(result.entries).toHaveLength(4);
    expect(result.vars.NODE_ENV).toBe('production');
    expect(result.vars.PORT).toBe('3000');
    expect(result.vars.QUOTED).toBe('hello world');
    expect(result.vars.INLINE).toBe('value');
    expect(result.invalidCount).toBe(0);
  });

  it('keeps invalid rows and duplicates in the result (invalid/dup rows stay)', () => {
    const result = parseEnvText('GOOD=1\nBAD LINE\n=empty\nGOOD=2');
    expect(result.invalidCount).toBe(2);
    expect(result.duplicates).toEqual({ GOOD: 2 });
    expect(result.vars.GOOD).toBe('2');
  });

  it('classifies sensitive keys into sensitiveVars and plain keys into plainVars', () => {
    const result = parseEnvText([
      'NODE_ENV=production',
      'S3_ACCESS_KEY=AKIA123',
      'DB_PASSWORD=secret',
      'PUBLIC_SITE_URL=https://staging.example.com',
      'SERVICE_TOKEN=abc',
      'API_KEY=xyz',
    ].join('\n'));
    expect(result.plainVars).toEqual({
      NODE_ENV: 'production',
      PUBLIC_SITE_URL: 'https://staging.example.com',
    });
    expect(result.sensitiveVars).toEqual({
      S3_ACCESS_KEY: 'AKIA123',
      DB_PASSWORD: 'secret',
      SERVICE_TOKEN: 'abc',
      API_KEY: 'xyz',
    });
  });

  it('does not classify ordinary keys as sensitive', () => {
    const result = parseEnvText('DATABASE_URL=postgres://x\nREDIS_HOST=redis\n');
    expect(Object.keys(result.sensitiveVars)).toHaveLength(0);
    expect(Object.keys(result.plainVars)).toEqual(['DATABASE_URL', 'REDIS_HOST']);
  });

  it('marks sensitive entries on the per-entry level for preview rendering', () => {
    const result = parseEnvText('NODE_ENV=production\nSTRIPE_SECRET_KEY=sk_live_x\n');
    const byKey = Object.fromEntries(result.entries.map((entry) => [entry.key, entry]));
    expect(byKey.NODE_ENV.sensitive).toBe(false);
    expect(byKey.STRIPE_SECRET_KEY.sensitive).toBe(true);
  });
});

describe('isSensitiveEnvKey', () => {
  it.each([
    'S3_ACCESS_KEY',
    'DB_PASSWORD',
    'API_TOKEN',
    'SERVICE_TOKEN',
    'STRIPE_SECRET_KEY',
    'JWT_SECRET',
    'API_KEY',
    'PRIVATE_KEY',
    'AUTH_TOKEN',
    'CREDENTIAL',
  ])('flags %s as suspected sensitive', (key) => {
    expect(isSensitiveEnvKey(key)).toBe(true);
  });

  it.each([
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'REDIS_HOST',
    'PUBLIC_SITE_URL',
    'LOG_LEVEL',
    'APP_NAME',
  ])('does not flag %s', (key) => {
    expect(isSensitiveEnvKey(key)).toBe(false);
  });
});
