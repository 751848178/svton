import { describe, expect, it } from 'vitest';
import {
  legacyRepositoryAnalysisRunHref,
  repositoryAnalysisPageHref,
} from './project-repository-analysis-route';

describe('project repository analysis route', () => {
  it('owns focused runs on the independent repository analysis page', () => {
    expect(repositoryAnalysisPageHref('project/1')).toBe(
      '/projects/project%2F1/repository-analysis',
    );
    expect(repositoryAnalysisPageHref('project/1', 'run/1')).toBe(
      '/projects/project%2F1/repository-analysis?analysisRunId=run%2F1',
    );
    expect(
      legacyRepositoryAnalysisRunHref(
        'project-1',
        new URLSearchParams('analysis=true&analysisRunId=run-1'),
      ),
    ).toBe('/projects/project-1/repository-analysis?analysisRunId=run-1');
    expect(legacyRepositoryAnalysisRunHref('project-1', new URLSearchParams('analysis=true'))).toBe(
      null,
    );
  });
});
