import { buildReleaseOrderInput, releaseOrderStatusTone } from './release-order.utils';

describe('release order helpers', () => {
  it('builds the named canonical-version create contract', () => {
    expect(buildReleaseOrderInput(' Stable ', ' 2.4.1 ', ' Production release ')).toEqual({
      releaseName: 'Stable',
      releaseVersion: '2.4.1',
      note: 'Production release',
    });
    expect(Object.keys(buildReleaseOrderInput('Patch', '2.4.2', ''))).toEqual([
      'releaseName',
      'releaseVersion',
    ]);
  });

  it('uses conservative status tones', () => {
    expect(releaseOrderStatusTone('draft')).toBe('idle');
    expect(releaseOrderStatusTone('active')).toBe('running');
    expect(releaseOrderStatusTone('failed')).toBe('error');
  });
});
