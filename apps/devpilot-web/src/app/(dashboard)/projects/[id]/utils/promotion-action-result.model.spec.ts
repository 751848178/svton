import { describe, expect, it } from 'vitest';
import { promotionActionDomainError } from './promotion-action-result.model';

describe('promotion action domain result', () => {
  it('surfaces HTTP 200 blocked results and leaves successful results quiet', () => {
    expect(promotionActionDomainError({ status: 'blocked',
      errorCode: 'PROVIDER_READBACK_BLOCKED', errorMessage: 'Provider state is unknown' }))
      .toBe('Provider state is unknown');
    expect(promotionActionDomainError({ status: 'completed' })).toBeNull();
  });
});
