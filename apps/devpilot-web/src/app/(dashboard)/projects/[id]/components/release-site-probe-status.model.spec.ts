import { describe, expect, it } from 'vitest';
import {
  siteProbeStatusTone,
  siteProbeStatusTranslationKey,
} from './release-site-probe-status.model';

describe('release site probe status presentation', () => {
  it('presents an explicitly disabled TLS probe as not required, not unavailable', () => {
    expect(siteProbeStatusTone('not_required')).toBe('neutral');
    expect(siteProbeStatusTranslationKey('not_required')).toBe('releaseSiteProbeNotRequired');
  });

  it('keeps success, failure and missing evidence semantically distinct', () => {
    expect(siteProbeStatusTone('resolved')).toBe('success');
    expect(siteProbeStatusTone('invalid')).toBe('danger');
    expect(siteProbeStatusTranslationKey(null)).toBe('releaseSiteProbeUnavailable');
  });
});
