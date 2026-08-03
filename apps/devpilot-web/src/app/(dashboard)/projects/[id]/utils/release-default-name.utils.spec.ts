import { buildReleaseDefaultName } from './release-default-name.utils';

describe('buildReleaseDefaultName', () => {
  it('uses local date parts instead of UTC serialization', () => {
    const fakeLocalDate = {
      getFullYear: () => 2026,
      getMonth: () => 6,
      getDate: () => 31,
      getHours: () => 17,
      getMinutes: () => 7,
    } as Date;

    expect(buildReleaseDefaultName(fakeLocalDate)).toBe('release-2026-07-31-1707');
  });
});
