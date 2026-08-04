import type { IntakeReviewItem, RepositoryIntakeContract } from './types';

export function defaultReviewItems(contract: RepositoryIntakeContract): IntakeReviewItem[] {
  return [
    ...(contract.overview
      ? [{ suggestionId: contract.overview.suggestionId, decision: 'accept' as const }]
      : []),
    ...contract.components.map((item) => ({
      suggestionId: item.suggestionId,
      decision: 'accept' as const,
    })),
    ...contract.dependencies.map((item) => ({
      suggestionId: item.suggestionId,
      decision: 'accept' as const,
    })),
  ];
}

export function repositoryReviewBlockers(
  contract: RepositoryIntakeContract | null,
  items: IntakeReviewItem[],
) {
  if (!contract) return [];
  const decisions = new Map(items.map((item) => [item.suggestionId, item.decision]));
  const accepted = contract.components.filter(
    (item) => decisions.get(item.suggestionId) !== 'reject',
  );
  return contract.dependencies
    .filter((item) => item.kind === 'environment'
      && decisions.get(item.suggestionId) === 'reject' && accepted.length > 0)
    .map(() => 'accepted_components_require_environment');
}
