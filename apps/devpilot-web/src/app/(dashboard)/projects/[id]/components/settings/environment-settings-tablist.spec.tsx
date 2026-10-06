import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentSettingsTablist } from './environment-settings-tablist';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('EnvironmentSettingsTablist basic profile', () => {
  it('exposes only targets, resources, and variables', () => {
    const html = renderToStaticMarkup(
      <EnvironmentSettingsTablist
        tablistId="environment-settings"
        panelId="environment-panel"
        selected="targets"
        onSelect={vi.fn()}
      />,
    );
    expect(html).toContain('envTabTargets');
    expect(html).toContain('envTabResources');
    expect(html).toContain('envTabVariables');
    expect(html).not.toContain('envTabVersions');
    expect(html).not.toContain('envTabAccess');
    expect(html).not.toContain('envTabVerification');
    expect(html).not.toContain('envTabRoutes');
  });
});
