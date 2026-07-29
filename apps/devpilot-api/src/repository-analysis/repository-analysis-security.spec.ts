import { BadRequestException } from '@nestjs/common';
import {
  validateRepositoryBranch,
  validateRepositoryUrl,
} from './repository-analysis-validation.utils';
import {
  isSecretEnvironmentName,
  redactRepositoryText,
  redactRepositoryValue,
} from './repository-analysis-redact.utils';

describe('repository analysis input security', () => {
  it.each([
    'https://github.com/example/repo.git',
    'ssh://git@example.com/example/repo.git',
    'git@example.com:example/repo.git',
  ])('accepts a supported credential-free repository URL: %s', (url) => {
    expect(validateRepositoryUrl(url, false)).toBe(url);
  });

  it.each([
    'https://token@github.com/example/repo.git',
    '--upload-pack=evil',
    'ftp://example.com/repo.git',
    'https://example.com/repo.git\n--config=evil',
  ])('rejects unsafe repository input: %s', (url) => {
    expect(() => validateRepositoryUrl(url, false)).toThrow(BadRequestException);
  });

  it('only allows local repositories when explicitly enabled', () => {
    expect(() => validateRepositoryUrl('/tmp/picshare', false)).toThrow(BadRequestException);
    expect(validateRepositoryUrl('/tmp/picshare', true)).toBe('/tmp/picshare');
  });

  it.each(['main', 'release/2026.07', 'feature_F384'])(
    'accepts a safe branch: %s',
    (branch) => expect(validateRepositoryBranch(branch)).toBe(branch),
  );

  it.each(['-main', 'main..evil', 'main@{1}', 'main//evil', 'main\\evil'])(
    'rejects a branch that can alter git argument meaning: %s',
    (branch) => expect(() => validateRepositoryBranch(branch)).toThrow(BadRequestException),
  );
});

describe('repository analysis redaction', () => {
  it('redacts tokens, private keys, URL userinfo, and caller-supplied secrets', () => {
    const privateKey = [
      '-----BEGIN OPENSSH PRIVATE KEY-----',
      'sensitive-key-material',
      '-----END OPENSSH PRIVATE KEY-----',
    ].join('\n');
    const result = redactRepositoryText(
      `ghp_abcdefghijklmnopqrstuvwxyz ${privateKey} https://user:pass@example.com secret-value`,
      ['secret-value'],
    );
    expect(result).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(result).not.toContain('sensitive-key-material');
    expect(result).not.toContain('user:pass');
    expect(result).not.toContain('secret-value');
  });

  it('redacts nested secret fields while preserving non-secret evidence', () => {
    expect(redactRepositoryValue({
      repositoryUrl: 'https://example.com/repo.git',
      accessToken: 'token',
      nested: { password: 'password', branch: 'main' },
    })).toEqual({
      repositoryUrl: 'https://example.com/repo.git',
      accessToken: '[REDACTED]',
      nested: { password: '[REDACTED]', branch: 'main' },
    });
  });

  it.each(['DATABASE_PASSWORD', 'JWT_SECRET', 'GITHUB_TOKEN', 'SSH_PRIVATE_KEY'])(
    'classifies secret environment names: %s',
    (name) => expect(isSecretEnvironmentName(name)).toBe(true),
  );
});
