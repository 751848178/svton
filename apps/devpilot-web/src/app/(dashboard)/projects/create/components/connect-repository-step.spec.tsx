import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectIntakeHook } from '../hooks/use-project-intake';
import { ConnectRepositoryStep } from './connect-repository-step';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Select: ({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: Array<{ label: string; value: string }>;
  }) => (
    <select {...props}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}));

describe('ConnectRepositoryStep repository-first layout', () => {
  it('keeps the repository URL as the only primary input before desktop optional details', () => {
    const html = renderToStaticMarkup(<ConnectRepositoryStep intake={fixture('public')} />);
    const detailsAt = html.indexOf('<details');
    expect(html.indexOf('https://github.com/organization/repository.git')).toBeLessThan(detailsAt);
    expect(html.indexOf('intakeProjectName')).toBeGreaterThan(detailsAt);
    expect(html.indexOf('branchLabel')).toBeGreaterThan(detailsAt);
    expect(html.indexOf('intakeVisibility')).toBeLessThan(detailsAt);
    expect(html).toContain('autofocus=""');
    expect(html).toContain('intakeOptionalDetails');
  });

  it('shows private credentials immediately before optional details in the 390px flow', () => {
    const html = renderToStaticMarkup(
      <ConnectRepositoryStep intake={fixture('private', 'inline')} />,
    );
    expect(html).toContain('min-h-11');
    expect(html).toContain('intakePrivateCredentialHint');
    expect(html.indexOf('intakePrivateCredentialHint')).toBeLessThan(html.indexOf('<details'));
    expect(html).toContain('private-repository-credential-hint');
    expect(html).toContain('autoComplete="off"');
  });
});

function fixture(
  visibility: 'public' | 'private',
  credentialMode: 'managed' | 'inline' = 'managed',
) {
  return {
    projectId: null,
    form: {
      repositoryUrl: '', visibility, name: '', branch: '', description: '',
      credentialMode, managedCredential: null, credentialType: 'https_token',
      credentialName: '', credentialUsername: '', credentialSecret: '',
    },
    updateForm: vi.fn(),
    credentialOptions: [],
  } as unknown as ProjectIntakeHook;
}
