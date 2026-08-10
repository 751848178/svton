import { describe, expect, it } from 'vitest';
import { ROUTE_SEGMENT_LABEL_KEYS, isStaticRouteSegment } from './route-labels';

describe('dashboard breadcrumb route labels', () => {
  it('localizes the V13 project creation and settings routes', () => {
    expect(ROUTE_SEGMENT_LABEL_KEYS).toMatchObject({
      create: 'createProject',
      settings: 'projectSettings',
    });
    expect(isStaticRouteSegment('settings')).toBe(true);
  });
});
