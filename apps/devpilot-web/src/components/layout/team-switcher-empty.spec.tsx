import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TeamSwitcherEmpty } from './team-switcher-empty';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('TeamSwitcherEmpty', () => {
  it('shows status without duplicating the team creation action', () => {
    const html = renderToStaticMarkup(<TeamSwitcherEmpty />);

    expect(html).toContain('noTeamHint');
    expect(html).not.toContain('<button');
  });
});
