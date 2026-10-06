import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ReleaseBuildActionBar,
  ReleasePublishActionBar,
} from './release-lifecycle-step-action-bar';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('release lifecycle step action bar', () => {
  it('keeps the build blocker and both actions in one responsive context', () => {
    const html = renderToStaticMarkup(
      <ReleaseBuildActionBar
        hasBuild={false}
        building={false}
        frozen={false}
        allowed={false}
        blockedReason="missing exact commit"
        onOpenHistory={vi.fn()}
        onBuildLatest={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="release-lifecycle-action-bar"');
    expect(html).toContain('data-testid="release-lifecycle-action-context"');
    expect(html).toContain('data-testid="release-lifecycle-action-buttons"');
    expect(html).toContain('missing exact commit');
    expect(html).toContain('text-left');
    expect(html).not.toContain('text-right');
    expect(html).toContain('aria-describedby="lifecycle-build-action-context"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('releaseRoundViewHistory');
    expect(html).toContain('buildLatestCode');
  });

  it('merges the no-build state into the action context and preserves mobile touch sizing', () => {
    const html = renderToStaticMarkup(
      <ReleaseBuildActionBar
        hasBuild={false}
        building={false}
        frozen={false}
        allowed
        onOpenHistory={vi.fn()}
        onBuildLatest={vi.fn()}
      />,
    );

    expect(html).toContain('releaseRoundNoBuild');
    expect(html.match(/releaseRoundNoBuild/g)).toHaveLength(1);
    expect(html).toContain('min-h-11');
    expect(html).toContain('sm:grid-cols-[minmax(0,1fr)_auto]');
  });

  it('keeps the publish repair link adjacent to its disabled reason', () => {
    const html = renderToStaticMarkup(
      <ReleasePublishActionBar
        deploying={false}
        disabled
        disabledReason="target unavailable"
        repairHref="/settings?envTab=targets"
        onOpenHistory={vi.fn()}
        onPublish={vi.fn()}
      />,
    );

    expect(html).toContain('target unavailable');
    expect(html).toContain('href="/settings?envTab=targets"');
    expect(html).toContain('aria-describedby="lifecycle-publish-action-context"');
    expect(html.indexOf('target unavailable')).toBeLessThan(
      html.indexOf('data-testid="release-lifecycle-action-buttons"'),
    );
  });

  it('uses MVP copy without suggesting hidden history surfaces', () => {
    const build = renderToStaticMarkup(
      <ReleaseBuildActionBar
        basic
        hasBuild
        building={false}
        frozen={false}
        allowed
        onBuildLatest={vi.fn()}
      />,
    );
    const deploy = renderToStaticMarkup(
      <ReleasePublishActionBar
        basic
        deploying={false}
        disabled={false}
        onPublish={vi.fn()}
      />,
    );
    expect(build).toContain('releaseBasicBuildActionReady');
    expect(deploy).toContain('releaseBasicDeployActionReady');
    expect(build + deploy).not.toContain('releaseRoundViewHistory');
  });

  it('keeps the completed deploy action in place and disables it', () => {
    const html = renderToStaticMarkup(
      <ReleasePublishActionBar
        basic
        deploying={false}
        completed
        disabled={false}
        onPublish={vi.fn()}
      />,
    );
    expect(html).toContain('releaseBasicDeployCompleted');
    expect(html).toContain('releaseBasicDeployedAction');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-describedby="lifecycle-publish-action-context"');
  });
});
