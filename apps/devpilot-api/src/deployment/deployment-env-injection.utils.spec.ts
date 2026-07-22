import {
  buildEnvCleanupStep,
  buildEnvWriteStep,
  formatEnvFile,
  interpolateEnvTemplate,
  listEnvVarKeys,
  redactEnvFile,
  renderEnvWriteCommandReal,
  resolveDeploymentEnvVars,
  type EnvInjectionCrypto,
  type EnvInjectionPrisma,
} from './deployment-env-injection.utils';

const DEPLOYMENT_RULES_PATH =
  '../server-executor/server-command-policy-deployment-rules.constants';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DEPLOYMENT_COMMAND_RULES } = require(DEPLOYMENT_RULES_PATH);

function makeCrypto(plain: Record<string, Record<string, unknown>>): EnvInjectionCrypto & {
  store: Record<string, Record<string, unknown>>;
} {
  return {
    store: plain,
    decrypt(encryptedText: string) {
      // For tests the "encrypted" string is just the instance id.
      return JSON.stringify(plain[encryptedText] ?? {});
    },
  };
}

describe('interpolateEnvTemplate', () => {
  it('interpolates a single-line mysql template and strips quotes', () => {
    const template =
      'DATABASE_URL="mysql://${username}:${password}@${host}:${port}/${database}"';
    const out = interpolateEnvTemplate(template, {
      username: 'user_db_picshare',
      password: 'abc123',
      host: 'devpilot-g003-mysql',
      port: 3306,
      database: 'db_picshare',
    });
    expect(out).toEqual({
      DATABASE_URL: 'mysql://user_db_picshare:abc123@devpilot-g003-mysql:3306/db_picshare',
    });
  });

  it('emits multiple keys from a multi-line redis template', () => {
    const template =
      'REDIS_HOST="${host}"\nREDIS_PORT="${port}"\nREDIS_PASSWORD="${password}"\nREDIS_DB="${db}"';
    const out = interpolateEnvTemplate(template, {
      host: 'devpilot-g003-redis',
      port: 6379,
      password: 'redis-pw',
      db: 3,
    });
    expect(out).toEqual({
      REDIS_HOST: 'devpilot-g003-redis',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: 'redis-pw',
      REDIS_DB: '3',
    });
  });

  it('leaves no template noise and skips malformed lines', () => {
    const template = 'A="${a}"\nnot-a-line\nB="${b}"\n${missing}';
    const out = interpolateEnvTemplate(template, { a: '1', b: '2' });
    expect(out).toEqual({ A: '1', B: '2' });
  });

  it('F5: rejects lowercase env keys (would yield a redacted cmd the policy rejects)', () => {
    const template = 'lower="${v}"\nUPPER="${v}"';
    const out = interpolateEnvTemplate(template, { v: 'x' });
    expect(out).toEqual({ UPPER: 'x' });
  });
});

describe('formatEnvFile / redactEnvFile / listEnvVarKeys', () => {
  const vars = { DATABASE_URL: 'mysql://u:p@h:3306/db', REDIS_HOST: 'redis' };

  it('formatEnvFile emits KEY=value lines in insertion order', () => {
    expect(formatEnvFile(vars)).toBe('DATABASE_URL=mysql://u:p@h:3306/db\nREDIS_HOST=redis');
  });

  it('formatEnvFile escapes literal newlines in values (F6)', () => {
    expect(formatEnvFile({ A: 'x\ny', B: 'p\r\nq' })).toBe('A=x\\ny\nB=p\\nq');
  });

  it('redactEnvFile replaces every value with ***REDACTED*** and keeps keys', () => {
    expect(redactEnvFile(vars)).toBe('DATABASE_URL=***REDACTED***\nREDIS_HOST=***REDACTED***');
  });

  it('listEnvVarKeys returns sorted keys', () => {
    expect(listEnvVarKeys({ Z: '1', A: '2', M: '3' })).toEqual(['A', 'M', 'Z']);
  });
});

describe('buildEnvWriteStep / buildEnvCleanupStep', () => {
  const vars = { DATABASE_URL: 'mysql://u:p@h:3306/db', REDIS_HOST: 'redis' };

  it('write step stores a REDACTED command and the real secretEnv', () => {
    const step = buildEnvWriteStep('/srv/app', vars);
    expect(step.key).toBe('write_env');
    expect(step.cwd).toBe('/srv/app');
    expect(step.required).toBe(true);
    expect(step.risk).toBe('high');
    expect(step.secretEnv).toEqual(vars);
    // The persisted command must NOT contain any real value.
    expect(step.command).toContain('***REDACTED***');
    expect(step.command).not.toContain('mysql://u:p@h');
    expect(step.command).not.toContain('redis');
    expect(step.command).toContain("cat > .env <<'DEVPLOT_ENV_EOF'");
    expect(step.command).toContain('DEVPLOT_ENV_EOF');
  });

  it('cleanup step is rm -f .env and low risk', () => {
    const step = buildEnvCleanupStep('/srv/app');
    expect(step.command).toBe('rm -f .env');
    expect(step.risk).toBe('low');
    expect(step.required).toBe(false);
  });
});

describe('renderEnvWriteCommandReal', () => {
  it('renders the REAL heredoc body from secretEnv values with a randomized delimiter', () => {
    const cmd = renderEnvWriteCommandReal({ DATABASE_URL: 'mysql://u:p@h/db' });
    // F4: delimiter is randomized (`DEVPLOT_ENV_EOF_<hex>`) and bookends the
    // heredoc; the body carries the real value.
    const match = cmd.match(/^cat > \.env <<'(DEVPLOT_ENV_EOF_[0-9a-f]{8})'\nDATABASE_URL=mysql:\/\/u:p@h\/db\n\1$/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^DEVPLOT_ENV_EOF_[0-9a-f]{8}$/);
  });

  it('escapes literal newlines in values so each entry is one heredoc line (F6)', () => {
    const cmd = renderEnvWriteCommandReal({ TLS_CERT: 'line1\nline2\nline3' });
    // The body must contain the escaped `\n` (backslash + n), not real newlines,
    // and the closing delimiter must be the final line.
    const lines = cmd.split('\n');
    expect(lines[0]).toMatch(/^cat > \.env <<'(DEVPLOT_ENV_EOF_[0-9a-f]{8})'$/);
    expect(lines[1]).toBe('TLS_CERT=line1\\nline2\\nline3');
    expect(lines[2]).toMatch(/^DEVPLOT_ENV_EOF_[0-9a-f]{8}$/);
    expect(lines.length).toBe(3);
  });

  it('F4: produces a delimiter that cannot appear in any value', () => {
    // A value containing the fixed delimiter prefix must not collide with the
    // randomized delimiter actually used.
    const tricky = { A: 'DEVPLOT_ENV_EOF_deadbeef' };
    const cmd = renderEnvWriteCommandReal(tricky);
    const delim = cmd.match(/<<(?:'(DEVPLOT_ENV_EOF_[0-9a-f]{8})')/)?.[1];
    expect(delim).toBeDefined();
    expect(delim).not.toBe('DEVPLOT_ENV_EOF_deadbeef');
    // The chosen delimiter does not appear inside the value line.
    const valueLine = cmd.split('\n')[1];
    expect(valueLine).not.toContain(delim);
  });
});

describe('resolveDeploymentEnvVars', () => {
  function makePrisma(rows: unknown[]): EnvInjectionPrisma {
    return {
      resourceInstance: {
        findMany: jest.fn().mockResolvedValue(rows),
      },
    };
  }

  it('returns {} when projectId or environmentId is missing', async () => {
    const prisma = makePrisma([]);
    const out = await resolveDeploymentEnvVars(
      prisma,
      makeCrypto({}),
      'team-1',
      undefined,
      'env-1',
    );
    expect(out).toEqual({});
    expect(prisma.resourceInstance.findMany).not.toHaveBeenCalled();
  });

  it('decrypts credentials and merges delivery + credentials, then interpolates envTemplate', async () => {
    const crypto = makeCrypto({
      'inst-mysql': { password: 'real-pw' },
    });
    const prisma = makePrisma([
      {
        id: 'inst-mysql',
        status: 'active',
        delivery: {
          host: 'devpilot-g003-mysql',
          port: 3306,
          username: 'user_db_picshare',
          database: 'db_picshare',
        },
        credentials: 'inst-mysql', // decrypted -> { password: 'real-pw' }
        resourceType: {
          id: 'rt-mysql',
          key: 'mysql',
          envTemplate:
            'DATABASE_URL="mysql://${username}:${password}@${host}:${port}/${database}"',
        },
      },
    ]);

    const out = await resolveDeploymentEnvVars(
      prisma,
      crypto,
      'team-1',
      'proj-1',
      'env-1',
    );

    expect(out).toEqual({
      DATABASE_URL: 'mysql://user_db_picshare:real-pw@devpilot-g003-mysql:3306/db_picshare',
    });
  });

  it('merges multiple instances (mysql + redis) into one map', async () => {
    const crypto = makeCrypto({
      'inst-mysql': { password: 'mysql-pw' },
      'inst-redis': { password: 'redis-pw' },
    });
    const prisma = makePrisma([
      {
        id: 'inst-mysql',
        status: 'active',
        delivery: { host: 'mysql-h', port: 3306, username: 'u', database: 'd' },
        credentials: 'inst-mysql',
        resourceType: {
          id: 'rt-mysql',
          key: 'mysql',
          envTemplate:
            'DATABASE_URL="mysql://${username}:${password}@${host}:${port}/${database}"',
        },
      },
      {
        id: 'inst-redis',
        status: 'active',
        delivery: { host: 'redis-h', port: 6379, db: 3 },
        credentials: 'inst-redis',
        resourceType: {
          id: 'rt-redis',
          key: 'redis',
          envTemplate:
            'REDIS_HOST="${host}"\nREDIS_PORT="${port}"\nREDIS_PASSWORD="${password}"\nREDIS_DB="${db}"',
        },
      },
    ]);

    const out = await resolveDeploymentEnvVars(
      prisma,
      crypto,
      'team-1',
      'proj-1',
      'env-1',
    );

    expect(out).toEqual({
      DATABASE_URL: 'mysql://u:mysql-pw@mysql-h:3306/d',
      REDIS_HOST: 'redis-h',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: 'redis-pw',
      REDIS_DB: '3',
    });
  });

  it('skips an instance whose envTemplate is missing', async () => {
    const prisma = makePrisma([
      {
        id: 'inst-bad',
        status: 'active',
        delivery: {},
        credentials: null,
        resourceType: { id: 'rt-x', key: 'x', envTemplate: null },
      },
    ]);
    const out = await resolveDeploymentEnvVars(
      prisma,
      makeCrypto({}),
      'team-1',
      'proj-1',
      'env-1',
    );
    expect(out).toEqual({});
  });

  it('tolerates a corrupt credentials blob (drops credentials, keeps delivery)', async () => {
    const crypto: EnvInjectionCrypto = {
      decrypt() {
        throw new Error('decryption failed');
      },
    };
    const prisma = makePrisma([
      {
        id: 'inst-mysql',
        status: 'active',
        delivery: { host: 'mysql-h', port: 3306, username: 'u', database: 'd' },
        credentials: 'garbage',
        resourceType: {
          id: 'rt-mysql',
          key: 'mysql',
          envTemplate:
            'DATABASE_URL="mysql://${username}:${password}@${host}:${port}/${database}"',
        },
      },
    ]);
    const out = await resolveDeploymentEnvVars(prisma, crypto, 'team-1', 'proj-1', 'env-1');
    // password missing (decryption failed -> empty credentials), template
    // still renders with an empty password segment.
    expect(out).toEqual({
      DATABASE_URL: 'mysql://u:@mysql-h:3306/d',
    });
  });
});

describe('command policy rules accept the redacted env-write step shape', () => {
  const vars = { DATABASE_URL: 'mysql://u:p@h/db', REDIS_HOST: 'redis' };

  it('the write-env-file rule matches the redacted command emitted by buildEnvWriteStep', () => {
    const step = buildEnvWriteStep('/srv/app', vars);
    const rule = DEPLOYMENT_COMMAND_RULES.find((r: { key: string }) => r.key === 'write-env-file');
    expect(rule).toBeDefined();
    expect(rule.pattern.test(step.command)).toBe(true);
  });

  it('the remove-env-file rule matches rm -f .env', () => {
    const step = buildEnvCleanupStep('/srv/app');
    const rule = DEPLOYMENT_COMMAND_RULES.find((r: { key: string }) => r.key === 'remove-env-file');
    expect(rule).toBeDefined();
    expect(rule.pattern.test(step.command)).toBe(true);
  });

  it('the write-env-file rule does NOT match a command containing real values', () => {
    const realCmd = renderEnvWriteCommandReal(vars);
    const rule = DEPLOYMENT_COMMAND_RULES.find((r: { key: string }) => r.key === 'write-env-file');
    expect(rule.pattern.test(realCmd)).toBe(false);
  });
});
