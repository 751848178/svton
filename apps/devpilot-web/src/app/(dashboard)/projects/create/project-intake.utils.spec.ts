import {
  buildSuggestionDecisions,
  deriveProjectName,
  isRequiredEnvironmentSuggestion,
  readAnalysisSummary,
} from './project-intake.utils';
import type { ProjectIntakeRun } from './types';

describe('project intake helpers', () => {
  it('derives a project name from HTTPS and SSH repositories', () => {
    expect(deriveProjectName('https://github.com/acme/payments.git')).toBe('payments');
    expect(deriveProjectName('git@github.com:acme/console.git')).toBe('console');
  });

  it('reads only numeric repository analysis summary fields', () => {
    expect(readAnalysisSummary({ services: 4, deployableServices: 3, warnings: 'x' })).toEqual({
      services: 4,
      deployableServices: 3,
      suggestions: 0,
      warnings: 0,
    });
  });

  it('turns the operator selection into explicit accept/reject decisions', () => {
    const run = {
      suggestions: [
        { id: 'a', status: 'pending' },
        { id: 'b', status: 'pending' },
        { id: 'c', status: 'applied' },
      ],
    } as ProjectIntakeRun;
    expect(buildSuggestionDecisions(run, new Set(['a']))).toEqual([
      { suggestionId: 'a', decision: 'accept' },
      { suggestionId: 'b', decision: 'reject' },
    ]);
  });

  it('requires a pending environment while an application suggestion is selected', () => {
    const run = {
      suggestions: [
        { id: 'environment', kind: 'environment', status: 'pending' },
        { id: 'application', kind: 'application_service', status: 'pending' },
      ],
    } as ProjectIntakeRun;
    expect(isRequiredEnvironmentSuggestion(run, new Set(['application']), 'environment')).toBe(
      true,
    );
    expect(isRequiredEnvironmentSuggestion(run, new Set(), 'environment')).toBe(false);
  });
});
