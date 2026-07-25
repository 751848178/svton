import { buildAlertDeepLink } from './monitoring-notification-deep-link.utils';

describe('buildAlertDeepLink', () => {
  const base = 'https://console.example.com';

  describe('log_*_count metrics', () => {
    it('builds /logs?streamId=&from=&to= deep link', () => {
      const url = buildAlertDeepLink(base, {
        metric: 'log_error_count',
        value: {
          streamId: 'svc-prod',
          from: '2026-07-25T00:00:00.000Z',
          to: '2026-07-25T01:00:00.000Z',
        },
      });
      expect(url).toBe(
        'https://console.example.com/logs?streamId=svc-prod&from=2026-07-25T00%3A00%3A00.000Z&to=2026-07-25T01%3A00%3A00.000Z',
      );
    });

    it('covers log_warning_count and log_fatal_count', () => {
      for (const metric of ['log_warning_count', 'log_fatal_count']) {
        expect(
          buildAlertDeepLink(base, {
            metric,
            value: { streamId: 's1' },
          }),
        ).toContain('/logs?streamId=s1');
      }
    });

    it('returns null when streamId is missing', () => {
      expect(
        buildAlertDeepLink(base, {
          metric: 'log_error_count',
          value: { from: '2026-07-25T00:00:00.000Z' },
        }),
      ).toBeNull();
    });

    it('omits from/to when absent', () => {
      expect(
        buildAlertDeepLink(base, {
          metric: 'log_error_count',
          value: { streamId: 's1' },
        }),
      ).toBe('https://console.example.com/logs?streamId=s1');
    });
  });

  describe('deployment_status metric', () => {
    it('builds /logs?deploymentRunId= deep link', () => {
      expect(
        buildAlertDeepLink(base, {
          metric: 'deployment_status',
          value: { deploymentRunId: 'run-abc' },
        }),
      ).toBe('https://console.example.com/logs?deploymentRunId=run-abc');
    });

    it('returns null when deploymentRunId missing', () => {
      expect(
        buildAlertDeepLink(base, {
          metric: 'deployment_status',
          value: { status: 'failed' },
        }),
      ).toBeNull();
    });
  });

  describe('deployment_smoke_check_failure metric', () => {
    it('uses latestRuns[0].id as deploymentRunId', () => {
      expect(
        buildAlertDeepLink(base, {
          metric: 'deployment_smoke_check_failure',
          value: {
            latestRuns: [
              { id: 'run-1', status: 'failed' },
              { id: 'run-2', status: 'completed' },
            ],
          },
        }),
      ).toBe('https://console.example.com/logs?deploymentRunId=run-1');
    });

    it('returns null when latestRuns empty', () => {
      expect(
        buildAlertDeepLink(base, {
          metric: 'deployment_smoke_check_failure',
          value: { latestRuns: [] },
        }),
      ).toBeNull();
    });
  });

  describe('non-linkable metrics', () => {
    it('returns null for unrelated metrics', () => {
      expect(
        buildAlertDeepLink(base, {
          metric: 'certificate_expiry',
          value: { days: 5 },
        }),
      ).toBeNull();
    });

    it('returns null when value is missing/null', () => {
      expect(
        buildAlertDeepLink(base, { metric: 'log_error_count', value: null }),
      ).toBeNull();
    });
  });

  describe('base URL handling', () => {
    it('strips trailing slashes', () => {
      expect(
        buildAlertDeepLink('https://console.example.com/', {
          metric: 'deployment_status',
          value: { deploymentRunId: 'r1' },
        }),
      ).toBe('https://console.example.com/logs?deploymentRunId=r1');
    });

    it('returns null when base is empty', () => {
      expect(
        buildAlertDeepLink('', {
          metric: 'log_error_count',
          value: { streamId: 's1' },
        }),
      ).toBeNull();
    });

    it('returns null when base is invalid', () => {
      expect(
        buildAlertDeepLink('not-a-url', {
          metric: 'log_error_count',
          value: { streamId: 's1' },
        }),
      ).toBeNull();
    });

    it('rejects non-http protocols', () => {
      expect(
        buildAlertDeepLink('file:///etc/passwd', {
          metric: 'log_error_count',
          value: { streamId: 's1' },
        }),
      ).toBeNull();
    });

    it('trims whitespace around base', () => {
      expect(
        buildAlertDeepLink('  https://console.example.com  ', {
          metric: 'deployment_status',
          value: { deploymentRunId: 'r1' },
        }),
      ).toBe('https://console.example.com/logs?deploymentRunId=r1');
    });
  });
});
