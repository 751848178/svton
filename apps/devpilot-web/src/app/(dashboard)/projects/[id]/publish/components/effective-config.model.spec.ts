import { describe, expect, it } from 'vitest';
import {
  buildEffectiveConfigSummary,
  deriveSecretEnvKey,
  deriveTemplateKeys,
} from './effective-config.model';

describe('deriveTemplateKeys', () => {
  it('extracts uppercase KEY names from envTemplate lines', () => {
    expect(deriveTemplateKeys('DATABASE_URL=mysql:host\nAPI_TOKEN=abc\ninvalid-line')).toEqual([
      'API_TOKEN',
      'DATABASE_URL',
    ]);
  });

  it('returns empty for missing templates and dedupes keys', () => {
    expect(deriveTemplateKeys(null)).toEqual([]);
    expect(deriveTemplateKeys('A=1\nA=2')).toEqual(['A']);
  });
});

describe('deriveSecretEnvKey', () => {
  it('uppercases and replaces invalid characters with underscores', () => {
    expect(deriveSecretEnvKey('my-api token')).toBe('MY_API_TOKEN');
  });
});

describe('buildEffectiveConfigSummary', () => {
  it('merges three sources into one row per key', () => {
    const summary = buildEffectiveConfigSummary({
      plainVariables: { LOG_LEVEL: 'info' },
      secretReferences: [{ id: 'sk-1', name: '支付密钥', targetEnvKey: 'PAY_SECRET' }],
      configuredSecretIds: ['sk-1'],
      resourceInjections: [{ key: 'DATABASE_URL', label: 'MySQL / orders-db' }],
    });
    expect(summary.totalCount).toBe(3);
    expect(summary.conflicts).toEqual([]);
    expect(summary.unknownSecrets).toEqual([]);
    const logRow = summary.rows.find((row) => row.key === 'LOG_LEVEL');
    expect(logRow).toMatchObject({ sources: ['custom'], value: 'info', conflict: false });
    const dbRow = summary.rows.find((row) => row.key === 'DATABASE_URL');
    expect(dbRow).toMatchObject({ sources: ['resource'], fromLabel: 'MySQL / orders-db' });
    const secretRow = summary.rows.find((row) => row.key === 'PAY_SECRET');
    expect(secretRow).toMatchObject({ sources: ['secret'], secretConfigured: true });
  });

  it('flags same key with multiple owners as conflict (backend ownership 口径)', () => {
    const summary = buildEffectiveConfigSummary({
      plainVariables: { DATABASE_URL: 'postgres://local' },
      resourceInjections: [{ key: 'DATABASE_URL', label: 'MySQL / orders-db' }],
    });
    expect(summary.conflicts).toEqual([{ key: 'DATABASE_URL', sources: ['custom', 'resource'] }]);
    const row = summary.rows.find((item) => item.key === 'DATABASE_URL');
    expect(row?.conflict).toBe(true);
  });

  it('does not treat two injections of the same source kind as source mix', () => {
    const summary = buildEffectiveConfigSummary({
      resourceInjections: [
        { key: 'REDIS_URL', label: 'Redis / cache-a' },
        { key: 'REDIS_URL', label: 'Redis / cache-b' },
      ],
    });
    expect(summary.rows.find((row) => row.key === 'REDIS_URL')?.sources).toEqual(['resource']);
  });

  it('lists secrets missing from the visible key list as unknown (warning, not blocking)', () => {
    const summary = buildEffectiveConfigSummary({
      secretReferences: [
        { id: 'sk-ok', name: 'ready', targetEnvKey: 'READY_KEY' },
        { id: 'sk-missing', name: 'gone' },
      ],
      configuredSecretIds: ['sk-ok'],
    });
    expect(summary.unknownSecrets).toEqual([{ key: 'GONE', name: 'gone' }]);
    // 密钥不可见不是发布阻断项（M8）：阻断只看冲突。
    expect(summary.conflicts).toEqual([]);
    expect(summary.rows.find((row) => row.key === 'READY_KEY')?.secretConfigured).toBe(true);
  });

  it('handles empty input', () => {
    expect(buildEffectiveConfigSummary({})).toEqual({
      rows: [],
      conflicts: [],
      unknownSecrets: [],
      totalCount: 0,
    });
  });
});
