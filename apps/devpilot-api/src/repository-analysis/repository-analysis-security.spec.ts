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
import { secureRepositoryCommands } from './repository-command-security.utils';
import { repositoryGitEnvironment } from './repository-git-environment.utils';

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

describe('repository Git process isolation', () => {
  it('passes only the required process environment into Git', () => {
    const environment = repositoryGitEnvironment('/tmp/devpilot-git-home', {
      PATH: '/test/bin',
      LANG: 'zh_CN.UTF-8',
      DATABASE_URL: 'mysql://secret',
      JWT_SECRET: 'sentinel-jwt',
      REPOSITORY_ANALYSIS_LOCAL_ROOTS: '/private/repositories',
    });

    expect(environment).toEqual({
      PATH: '/test/bin',
      LANG: 'zh_CN.UTF-8',
      LC_ALL: 'zh_CN.UTF-8',
      HOME: '/tmp/devpilot-git-home',
      XDG_CONFIG_HOME: '/tmp/devpilot-git-home',
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_OPTIONAL_LOCKS: '0',
    });
    expect(environment).not.toHaveProperty('DATABASE_URL');
    expect(environment).not.toHaveProperty('JWT_SECRET');
  });
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

  it('preserves Date values for API serialization', () => {
    const createdAt = new Date('2026-07-29T12:00:00.000Z');

    expect(redactRepositoryValue({ createdAt, accessToken: 'token' })).toEqual({
      createdAt,
      accessToken: '[REDACTED]',
    });
  });

  it('redacts database URI userinfo and literal secret command assignments', () => {
    const result = redactRepositoryText(
      'DATABASE_URL=mysql://db-user:sentinel-db@mysql:3306/app '
      + 'JWT_SECRET=sentinel-jwt --password=sentinel-cli',
    );
    expect(result).not.toContain('sentinel-');
    expect(result).toContain('DATABASE_URL=[REDACTED]');
    expect(result).toContain('JWT_SECRET=[REDACTED]');
    expect(result).toContain('--password=[REDACTED]');
  });

  it('preserves environment references and omits only literal-secret commands', () => {
    const secured = secureRepositoryCommands({
      start: 'JWT_SECRET=$JWT_SECRET node server.js',
      migrate: 'DATABASE_URL=mysql://db-user:sentinel-db@mysql/app prisma migrate deploy',
    });
    expect(secured.commands.start).toBe('JWT_SECRET=$JWT_SECRET node server.js');
    expect(secured.commands.migrate).toBeUndefined();
    expect(secured.warnings).toHaveLength(1);
    expect(JSON.stringify(secured)).not.toContain('sentinel-db');
  });

  it.each(['DATABASE_PASSWORD', 'JWT_SECRET', 'GITHUB_TOKEN', 'SSH_PRIVATE_KEY'])(
    'classifies secret environment names: %s',
    (name) => expect(isSecretEnvironmentName(name)).toBe(true),
  );
});
