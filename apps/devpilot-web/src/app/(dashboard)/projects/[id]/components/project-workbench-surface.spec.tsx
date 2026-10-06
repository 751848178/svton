import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProjectTableSurface, ProjectTableViewport } from './project-workbench-surface';

describe('ProjectTableViewport', () => {
  it('contains a wide table inside its own keyboard reachable scroll region', () => {
    const html = renderToStaticMarkup(
      <ProjectTableViewport label="Deployment runs">
        <table className="min-w-[1080px]" />
      </ProjectTableViewport>,
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Deployment runs"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('min-h-0 max-w-full flex-1 overflow-auto overscroll-contain');
    expect(html).toContain('min-w-[1080px]');
  });

  it('lets a table surface own the remaining height at every viewport size', () => {
    const html = renderToStaticMarkup(
      <ProjectTableSurface
        title="Deployment runs"
        fillAvailableHeight
      >
        <div>rows</div>
      </ProjectTableSurface>,
    );

    expect(html).toContain('data-project-table-surface="true"');
    expect(html).toContain('flex min-h-0 flex-1 flex-col');
    expect(html).toContain('data-project-table-content="true"');
    expect(html).toContain('overflow-hidden');
  });

  it('removes card chrome from an embedded tab table without removing overflow containment', () => {
    const html = renderToStaticMarkup(
      <ProjectTableSurface variant="embedded">
        <table className="min-w-[920px]" />
      </ProjectTableSurface>,
    );

    expect(html).toContain('data-project-table-variant="embedded"');
    expect(html).toContain('max-w-full overflow-hidden bg-background');
    expect(html).not.toContain('rounded-xl');
    expect(html).not.toContain('border-border/70');
    expect(html).not.toContain('shadow-[');
    expect(html).toContain('overflow-x-auto');
  });
});
