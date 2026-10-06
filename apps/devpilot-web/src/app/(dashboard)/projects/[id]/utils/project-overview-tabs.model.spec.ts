import { describe, expect, it } from 'vitest';
import {
  nextProjectOverviewTab,
  projectOverviewTabFromSearchParams,
  projectOverviewTabHref,
} from './project-overview-tabs.model';

describe('nextProjectOverviewTab', () => {
  it('wraps horizontal arrow navigation', () => {
    expect(nextProjectOverviewTab('releases', 'ArrowRight')).toBe('environments');
    expect(nextProjectOverviewTab('environments', 'ArrowRight')).toBe('components');
    expect(nextProjectOverviewTab('components', 'ArrowRight')).toBe('releases');
    expect(nextProjectOverviewTab('releases', 'ArrowLeft')).toBe('components');
  });

  it('supports Home and End without changing on unrelated keys', () => {
    expect(nextProjectOverviewTab('components', 'Home')).toBe('releases');
    expect(nextProjectOverviewTab('releases', 'End')).toBe('components');
    expect(nextProjectOverviewTab('releases', 'Enter')).toBe('releases');
  });

  it('parses and writes URL-backed tab state without dropping other parameters', () => {
    expect(projectOverviewTabFromSearchParams(new URLSearchParams('view=components'))).toBe(
      'components',
    );
    expect(projectOverviewTabFromSearchParams(new URLSearchParams('view=details'))).toBe(
      'environments',
    );
    expect(projectOverviewTabFromSearchParams(new URLSearchParams('view=unknown'))).toBe(
      'releases',
    );
    expect(
      projectOverviewTabHref('project/1', new URLSearchParams('repository=true'), 'components'),
    ).toBe('/projects/project%2F1?repository=true&view=components');
    expect(
      projectOverviewTabHref('project-1', new URLSearchParams('view=components'), 'releases'),
    ).toBe('/projects/project-1');
  });
});
