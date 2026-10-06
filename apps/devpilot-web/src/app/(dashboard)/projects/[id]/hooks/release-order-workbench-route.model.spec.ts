import { describe, expect, it } from 'vitest';
import { canonicalReleaseWorkbenchParams } from './release-order-workbench-route.model';

describe('canonicalReleaseWorkbenchParams', () => {
  it('keeps an exact staging validation evidence deep link', () => {
    expect(
      canonicalReleaseWorkbenchParams(
        new URLSearchParams(
          'step=staging&deploymentRunId=run-1&deploymentEvidence=validation&stagingStep=validation',
        ),
      ),
    ).toBeNull();
  });

  it('removes an orphan validation view without discarding an exact run log focus', () => {
    expect(
      canonicalReleaseWorkbenchParams(
        new URLSearchParams('step=staging&deploymentRunId=run-1&deploymentEvidence=unknown'),
      ),
    ).toEqual({
      step: 'staging',
      chain: 'staging',
      history: null,
      focus: { deploymentRunId: 'run-1' },
    });
  });

  it('keeps a route-backed staging validation substep without an open drawer', () => {
    expect(
      canonicalReleaseWorkbenchParams(new URLSearchParams('step=staging&stagingStep=validation')),
    ).toBeNull();
  });
});
