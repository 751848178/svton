import { ApiError } from '@svton/api-client';
import { shouldReportLoadError } from './load-error.utils';

describe('shouldReportLoadError', () => {
  it.each([400, 401, 403, 404, 409, 422])(
    'keeps expected HTTP %s client errors in rendered UI state',
    (code) => {
      expect(shouldReportLoadError(new ApiError(code, 'expected'))).toBe(false);
    },
  );

  it.each([500, 503, 'NETWORK_ERROR'])('reports unexpected %s failures', (code) => {
    expect(shouldReportLoadError(new ApiError(code, 'unexpected'))).toBe(true);
  });

  it('reports unknown failures', () => {
    expect(shouldReportLoadError(new Error('unexpected'))).toBe(true);
  });
});
