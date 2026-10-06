import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { completionFixture } from './release-completion-record.test-fixture';
import { ReleaseStepCompletionPanel } from './release-step-completion-panel';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
vi.mock('@phosphor-icons/react', () => ({ ArrowUpRight: () => null }));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('ReleaseStepCompletionPanel', () => {
  it('stays pending when the exact DeploymentRun is absent', () => {
    const fixture = completionFixture();
    fixture.evidence.productionDeployment = null;
    const html = renderToStaticMarkup(
      <ReleaseStepCompletionPanel
        detail={fixture.detail}
        lifecycleEvidence={fixture.evidence}
      />,
    );
    expect(html).toContain('releaseCompletionPending');
    expect(html).toContain('releaseCompletionBlocker.deploymentRun');
    expect(html).not.toContain('releaseStepStateCompleted');
  });

  it('shows final facts, six validations, DeploymentRun evidence, and project release audit', () => {
    const fixture = completionFixture();
    const html = renderToStaticMarkup(
      <ReleaseStepCompletionPanel
        detail={fixture.detail}
        lifecycleEvidence={fixture.evidence}
      />,
    );
    expect(html).toContain('releaseStepStateCompleted');
    expect(html).toContain('deployment-1');
    expect(html).toContain('version-1');
    expect(html).toContain('releaseCompletionEffectiveAt');
    expect(html).toContain('/projects/project-1/deployments?runId=deployment-1');
    expect(html).toContain('/audit-events?projectId=project-1&amp;category=release');
    for (const key of [
      'artifactIntegrity',
      'environmentVersion',
      'workloadReady',
      'healthProbe',
      'entryProbe',
      'routeSwitch',
    ]) {
      expect(html).toContain(`releaseProductionValidationCheck.${key}`);
    }
  });
});
