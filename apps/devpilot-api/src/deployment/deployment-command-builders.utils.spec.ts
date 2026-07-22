import {
  buildCommandSteps,
  buildRollbackCommandSteps,
  type DeploymentConfig,
} from './deployment-command-builders.utils';

const config: DeploymentConfig = {
  targetType: 'server',
  workingDirectory: '/srv/app',
  buildCommand: 'pnpm build',
  deployCommand: 'docker compose -f docker-compose.devpilot.yml up -d --build backend',
  rollbackCommand: 'docker compose -f docker-compose.devpilot.yml up -d --build backend',
  healthCheckUrl: 'http://127.0.0.1:4100/api',
};

describe('buildCommandSteps with envVars', () => {
  it('inserts write_env before deploy and cleanup_env after health_check when envVars present', () => {
    const steps = buildCommandSteps(
      config,
      'git@example.com:repo/app.git',
      'main',
      { DATABASE_URL: 'mysql://u:p@h/db' },
    );
    const keys = steps.map((s) => s.key);
    expect(keys).toEqual([
      'checkout',
      'build',
      'write_env',
      'deploy',
      'health_check',
      'cleanup_env',
    ]);
    const writeStep = steps.find((s) => s.key === 'write_env')!;
    expect(writeStep.secretEnv).toEqual({ DATABASE_URL: 'mysql://u:p@h/db' });
    expect(writeStep.command).toContain('***REDACTED***');
    expect(writeStep.command).not.toContain('mysql://u:p@h/db');
  });

  it('does not insert write_env / cleanup_env when envVars is empty or absent', () => {
    const keysWithout = buildCommandSteps(config, 'git@x:y.git', 'main', {}).map((s) => s.key);
    expect(keysWithout).toEqual(['checkout', 'build', 'deploy', 'health_check']);

    const keysAbsent = buildCommandSteps(config, 'git@x:y.git', 'main').map((s) => s.key);
    expect(keysAbsent).toEqual(['checkout', 'build', 'deploy', 'health_check']);
  });
});

describe('buildRollbackCommandSteps with envVars', () => {
  it('inserts write_env before deploy_rollback and cleanup_env at the end', () => {
    const steps = buildRollbackCommandSteps(
      config,
      'git@example.com:repo/app.git',
      'abc1234567',
      { DATABASE_URL: 'mysql://u:p@h/db' },
    );
    const keys = steps.map((s) => s.key);
    expect(keys).toEqual([
      'checkout_rollback',
      'build_rollback',
      'write_env',
      'deploy_rollback',
      'health_check',
      'cleanup_env',
    ]);
  });
});
