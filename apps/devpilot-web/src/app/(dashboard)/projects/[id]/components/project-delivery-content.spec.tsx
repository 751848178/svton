import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDeliveryContent } from './project-delivery-content';

vi.mock('./release-orders-panel', () => ({ ReleaseOrdersPanel: () => <div>orders-panel</div> }));

describe('ProjectDeliveryContent', () => {
  it('keeps environment versions out of release navigation and renders release orders only', () => {
    const html = renderToStaticMarkup(
      <ProjectDeliveryContent
        projectId="project-1"
        orders={{} as never}
      />,
    );
    expect(html).toContain('orders-panel');
    expect(html).not.toContain('tabEnvironmentVersions');
    expect(html).not.toContain('environment-panel');
  });
});
