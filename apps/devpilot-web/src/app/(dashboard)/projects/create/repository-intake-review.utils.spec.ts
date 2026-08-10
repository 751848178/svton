import { defaultReviewItems, repositoryReviewBlockers } from './repository-intake-review.utils';
import type { RepositoryIntakeContract } from './types';

const contract = {
  overview: { suggestionId: 'repo' },
  components: [{ suggestionId: 'api' }],
  dependencies: [{ suggestionId: 'env', kind: 'environment' }],
} as RepositoryIntakeContract;

describe('repository intake review state', () => {
  it('starts every stored suggestion with an explicit accept decision', () => {
    expect(defaultReviewItems(contract)).toEqual([
      { suggestionId: 'repo', decision: 'accept' },
      { suggestionId: 'api', decision: 'accept' },
      { suggestionId: 'env', decision: 'accept' },
    ]);
  });

  it('blocks rejecting an environment until dependent components are rejected', () => {
    expect(repositoryReviewBlockers(contract, [
      { suggestionId: 'api', decision: 'accept' },
      { suggestionId: 'env', decision: 'reject' },
    ])).toEqual(['accepted_components_require_environment']);
    expect(repositoryReviewBlockers(contract, [
      { suggestionId: 'api', decision: 'reject' },
      { suggestionId: 'env', decision: 'reject' },
    ])).toEqual([]);
  });
});
