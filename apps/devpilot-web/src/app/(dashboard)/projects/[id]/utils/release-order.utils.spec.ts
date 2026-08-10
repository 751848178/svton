import { buildReleaseOrderInput, releaseOrderStatusTone } from './release-order.utils';

describe('release order helpers', () => {
  it('builds the create contract from version and optional note only', () => {
    expect(buildReleaseOrderInput(' 2.4.1 ', ' Production release ')).toEqual({
      releaseVersion: '2.4.1',
      note: 'Production release',
    });
    expect(Object.keys(buildReleaseOrderInput('2.4.2', ''))).toEqual(['releaseVersion']);
  });

  it('uses conservative status tones', () => {
    expect(releaseOrderStatusTone('draft')).toBe('idle');
    expect(releaseOrderStatusTone('active')).toBe('running');
    expect(releaseOrderStatusTone('failed')).toBe('error');
  });
});
