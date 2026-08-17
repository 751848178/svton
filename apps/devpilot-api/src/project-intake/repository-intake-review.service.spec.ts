import { ConflictException } from '@nestjs/common';
import { RepositoryIntakeReviewService } from './repository-intake-review.service';

const dto = { items: [{ suggestionId: 'repo', decision: 'accept' as const }] };
function run(snapshot: { inputHash: string } | null = null) {
  return {
    id: 'run-1', projectId: 'project-1', status: 'succeeded', branch: 'main',
    commitSha: 'a'.repeat(40), parserVersion: 'v1', intakeReviewSnapshot: snapshot,
    connection: { commitSha: 'a'.repeat(40) },
    suggestions: [{
      id: 'repo', key: 'project_repository', kind: 'project_repository',
      proposedValue: { intakeContract: { overview: {} } },
    }],
  };
}
function harness(record = run()) {
  const repository = {
    load: jest.fn().mockResolvedValue(record),
    findSnapshot: jest.fn(),
  };
  const contracts = { read: jest.fn().mockResolvedValue({ snapshot: { id: 'snapshot-1' } }) };
  const suggestions = { apply: jest.fn().mockResolvedValue({}) };
  return {
    repository, contracts, suggestions,
    service: new RepositoryIntakeReviewService(repository as never, contracts as never, suggestions as never),
  };
}

describe('RepositoryIntakeReviewService', () => {
  it('passes normalized input hash into the transactional snapshot apply', async () => {
    const { service, suggestions } = harness();
    await service.review('team-1', 'actor-1', 'project-1', 'run-1', dto);
    expect(suggestions.apply).toHaveBeenCalledWith(
      'team-1', 'actor-1', 'project-1', 'run-1',
      { decisions: [{ suggestionId: 'repo', decision: 'accept' }] },
      { version: 1, inputHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
      undefined,
    );
  });

  it('returns the immutable winner for an exact replay and rejects changed input', async () => {
    const first = harness();
    await first.service.review('team-1', 'actor-1', 'project-1', 'run-1', dto);
    const hash = first.suggestions.apply.mock.calls[0][5].inputHash;
    const replay = harness(run({ inputHash: hash }));
    await expect(replay.service.review('team-1', 'actor-1', 'project-1', 'run-1', dto))
      .resolves.toEqual({ snapshot: { id: 'snapshot-1' } });
    expect(replay.suggestions.apply).not.toHaveBeenCalled();

    const conflict = harness(run({ inputHash: 'b'.repeat(64) }));
    await expect(conflict.service.review('team-1', 'actor-1', 'project-1', 'run-1', dto))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('distinguishes a stale commit from retrying the same pinned snapshot', async () => {
    const stale = run();
    stale.connection.commitSha = 'b'.repeat(40);
    const { service } = harness(stale);
    try {
      await service.review('team-1', 'actor-1', 'project-1', 'run-1', dto);
      throw new Error('expected stale conflict');
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'REPOSITORY_ANALYSIS_STALE',
        action: expect.stringContaining('重新验证仓库'),
      });
    }
  });
});
