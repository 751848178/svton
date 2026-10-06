import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVersionEnvironment } from '../types/environment-version.types';
import { ProjectContextIssue } from './project-context-issue';
import { ProjectEnvironmentVersionRow } from './project-environment-version-row';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('project compact action touch targets', () => {
  it('keeps the project repair action at least 44px high on narrow screens', () => {
    const html = renderToStaticMarkup(
      <ProjectContextIssue
        message="missing components"
        actionLabel="repair"
        href="/projects/project-1/settings"
      />,
    );
    expect(html).toContain('min-h-11');
    expect(html).toContain('sm:min-h-8');
    expect(html).toContain('border-warning/40');
    expect(html).toContain('bg-warning/10');
  });

  it('applies the same responsive target to environment row actions', () => {
    const environment = {
      id: 'environment-1',
      key: 'staging',
      name: 'Staging',
      baselineRole: 'staging',
      currentEnvironmentVersionId: null,
      environmentVersions: [],
    } as unknown as EnvironmentVersionEnvironment;
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <ProjectEnvironmentVersionRow
            projectId="project-1"
            environment={environment}
            candidates={[]}
            onSwitch={vi.fn()}
          />
        </tbody>
      </table>,
    );
    expect((html.match(/min-h-11/g) ?? []).length).toBe(2);
    expect(html).toContain(
      '/projects/project-1/settings?section=environments&amp;envTab=versions&amp;env=staging',
    );
  });
});
