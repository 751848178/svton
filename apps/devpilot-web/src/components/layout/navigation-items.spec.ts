import { describe, expect, it } from 'vitest';

import { findActiveNavItem, navigationSections, primaryHeaderLinks } from './navigation-items';

describe('project directory navigation', () => {
  it('uses one canonical sidebar create entry and no duplicate header CTA', () => {
    const projectItems = navigationSections
      .flatMap((section) => section.items)
      .filter((item) => item.href === '/projects' || item.href.startsWith('/projects/'));

    expect(projectItems).toEqual([
      { href: '/projects', labelKey: 'myProjects', icon: 'folder-git' },
      { href: '/projects/create', labelKey: 'createProject', icon: 'folder-plus' },
    ]);
    expect(findActiveNavItem('/projects/project-123', projectItems)?.href).toBe('/projects');
    expect(findActiveNavItem('/projects/create', projectItems)?.href).toBe('/projects/create');
    expect(primaryHeaderLinks).toEqual([]);
  });
});
