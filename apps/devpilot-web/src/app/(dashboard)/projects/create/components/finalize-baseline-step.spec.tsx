import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FinalizeBaselineStep } from './finalize-baseline-step';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('FinalizeBaselineStep baseline explanation', () => {
  it('explains why Staging and Production are fixed governed baselines', () => {
    const html = renderToStaticMarkup(<FinalizeBaselineStep intake={{
      form: { name: 'app', repositoryUrl: 'repo', branch: 'main' },
      connection: { selectedBranch: 'main', commitSha: 'a'.repeat(40) },
      contract: null,
    } as never} />);
    expect(html).toContain('intakeStagingBaselineReason');
    expect(html).toContain('intakeProductionBaselineReason');
  });
});
