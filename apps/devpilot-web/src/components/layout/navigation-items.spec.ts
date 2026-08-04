import { describe, expect, it } from 'vitest';

import { findActiveNavItem, navigationSections } from './navigation-items';

describe('project directory navigation', () => {
  it('keeps exactly one sidebar project module entry', () => {
    const projectItems = navigationSections
      .flatMap((section) => section.items)
      .filter((item) => item.href === '/projects' || item.href.startsWith('/projects/'));

    expect(projectItems).toEqual([
      { href: '/projects', labelKey: 'myProjects', icon: 'folder-git' },
    ]);
    expect(findActiveNavItem('/projects/project-123', projectItems)?.href).toBe('/projects');
  });
});
