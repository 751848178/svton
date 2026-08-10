import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentEnvCopyDialog } from './environment-env-copy-dialog';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@svton/ui', () => ({
  Modal: ({ open, title, children, footer }: { open: boolean; title: string; children: React.ReactNode; footer: React.ReactNode }) =>
    open ? (
      <div>
        <div>{title}</div>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}));

const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key) as never;

function environment(id: string, key: string, name: string, status = 'active') {
  return {
    id,
    key,
    name,
    status,
    currentConfigRevisionId: `rev-${key}`,
  } as never;
}

describe('EnvironmentEnvCopyDialog (F447 AC-SET-036)', () => {
  it('lists target environments (excluding the source), previews vars and secret refs', () => {
    const html = renderToStaticMarkup(
      <EnvironmentEnvCopyDialog
        open
        onClose={() => undefined}
        environments={[
          environment('env-staging', 'staging', 'Staging'),
          environment('env-preview', 'preview', 'Preview'),
          environment('env-prod', 'production', 'Production'),
        ]}
        sourceEnvironment={environment('env-staging', 'staging', 'Staging')}
        plainVars={{ NODE_ENV: 'production' }}
        secretRefs={[{ id: 'secret-1', name: 's3_access_key', type: 'aws' }]}
        copy={vi.fn()}
        copying={false}
        onCopied={() => undefined}
        t={t}
      />,
    );

    expect(html).toContain('envVarsCopyTitle');
    expect(html).toContain('envVarsCopyPreviewVars:{&quot;count&quot;:1}');
    expect(html).toContain('envVarsCopyPreviewSecrets:{&quot;count&quot;:1}');
    expect(html).toContain('s3_access_key');
    expect(html).toContain('envVarsCopySelectTargets');
    expect(html).toContain('preview · Preview');
    expect(html).toContain('production · Production');
    // Source environment is not offered as a target label.
    expect(html).not.toContain('Staging · Staging');
    expect(html).toContain('envVarsCopyConfirm');
  });

  it('hides the source environment and only shows same-project active environments', () => {
    const html = renderToStaticMarkup(
      <EnvironmentEnvCopyDialog
        open
        onClose={() => undefined}
        environments={[
          environment('env-a', 'a', 'A'),
          environment('env-b', 'b', 'B'),
          environment('env-archived', 'archived', 'Archived', 'archived'),
        ]}
        sourceEnvironment={environment('env-a', 'a', 'A')}
        plainVars={{}}
        secretRefs={[]}
        copy={vi.fn()}
        copying={false}
        onCopied={() => undefined}
        t={t}
      />,
    );

    expect(html).toContain('b · B');
    expect(html).not.toContain('archived');
    expect(html).toContain('envVarsCopyPreviewEmpty');
  });
});
