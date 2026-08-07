import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentEnvVarsTable } from './environment-env-vars-table';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const t = ((key: string) => key) as never;

describe('EnvironmentEnvVarsTable (F447 AC-SET-041)', () => {
  it('renders the Demo 6-column table with honest 来源 values', () => {
    const html = renderToStaticMarkup(
      <EnvironmentEnvVarsTable
        plainVars={{ NODE_ENV: 'production', 'BAD KEY': 'x' }}
        secretRefs={[{ id: 'secret-1', name: 's3_access_key', type: 'aws' }]}
        committedSecretIds={new Set(['secret-1'])}
        resourceInjections={[{ key: 'DATABASE_URL', label: 'PostgreSQL / pg-shared-nonprod' }]}
        t={t}
      />,
    );

    for (const header of [
      'envVarsTableKey',
      'envVarsTableScope',
      'envVarsTableSource',
      'envVarsTableValue',
      'envVarsTableRequirement',
      'envVarsTableValidation',
    ]) {
      expect(html).toContain(header);
    }
    expect(html).toContain('NODE_ENV');
    expect(html).toContain('envVarsSourcePlain');
    expect(html).toContain('envVarsSourceSecret');
    expect(html).toContain('envVarsSourceResource');
    expect(html).toContain('PostgreSQL / pg-shared-nonprod');
    expect(html).toContain('envVarsRequirementRequired');
    expect(html).toContain('envVarsRequirementSensitive');
    expect(html).toContain('envVarsValidationValid');
    expect(html).toContain('envVarsValidationInvalid');
    expect(html).toContain('envVarsScopeEnv');
  });

  it('masks secret refs as vault-style references and never renders plaintext values', () => {
    const html = renderToStaticMarkup(
      <EnvironmentEnvVarsTable
        plainVars={{ PUBLIC_SITE_URL: 'https://staging.example.com' }}
        secretRefs={[{ id: 'secret-9', name: 's3_secret_key', type: 'aws' }]}
        committedSecretIds={new Set()}
        resourceInjections={[]}
        t={t}
      />,
    );

    expect(html).toContain('vault://s3_secret_key@secret-9 · ••••••••');
    expect(html).not.toMatch(/AKIA|plaintext-secret|super-secret/i);
    // Uncommitted reference is honest: 待生效
    expect(html).toContain('envVarsValidationPending');
  });

  it('shows an empty state without inventing rows', () => {
    const html = renderToStaticMarkup(
      <EnvironmentEnvVarsTable
        plainVars={{}}
        secretRefs={[]}
        committedSecretIds={new Set()}
        resourceInjections={[]}
        t={t}
      />,
    );
    expect(html).toContain('envVarsTableEmpty');
  });
});
