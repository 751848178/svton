import { RepositoryAnalysisWorkerService } from './repository-analysis-worker.service';

const RUN = {
  id: 'run-1',
  teamId: 'team-1',
  projectId: 'project-1',
  triggeredById: 'user-1',
  repositoryUrl: 'https://example.com/repo.git',
  branch: 'main',
  commitSha: 'a'.repeat(40),
  parserVersion: 'repository-parser-v1',
  connection: {},
};

function createHarness(timeoutMs: number) {
  const config = { get: jest.fn().mockReturnValue(timeoutMs) };
  const runs = {
    findWorkerRun: jest.fn().mockResolvedValue(RUN),
    isCancelRequested: jest.fn().mockResolvedValue(false),
    start: jest.fn(),
    succeed: jest.fn(),
    terminal: jest.fn(),
    recoverActiveIds: jest.fn().mockResolvedValue([]),
  };
  const stages = {
    start: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    cancelRemaining: jest.fn(),
  };
  const credentials = {
    resolveStored: jest.fn().mockResolvedValue({ kind: 'none' }),
  };
  const git = { checkout: jest.fn() };
  const inventory = { inventory: jest.fn() };
  const parser = { parse: jest.fn() };
  const suggestions = { build: jest.fn() };
  const audit = { record: jest.fn() };
  const worker = new RepositoryAnalysisWorkerService(
    config as never,
    runs as never,
    stages as never,
    credentials as never,
    git as never,
    inventory as never,
    parser as never,
    suggestions as never,
    audit as never,
  );
  return { worker, runs, stages, git, inventory, parser, audit };
}

async function execute(worker: RepositoryAnalysisWorkerService) {
  await (worker as unknown as { execute: (runId: string) => Promise<void> })
    .execute(RUN.id);
}

describe('RepositoryAnalysisWorkerService failures', () => {
  it('marks a whole-run timeout failed and cancels remaining stages', async () => {
    const harness = createHarness(5);
    harness.git.checkout.mockImplementation(
      (_url: string, _branch: string, _sha: string, _credential: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    );

    await execute(harness.worker);

    expect(harness.stages.fail).toHaveBeenCalledWith(
      RUN.id,
      'checkout',
      'REPOSITORY_ANALYSIS_TIMEOUT',
      expect.any(String),
    );
    expect(harness.stages.cancelRemaining).toHaveBeenCalledWith(RUN.id);
    expect(harness.runs.terminal).toHaveBeenCalledWith(
      RUN.id,
      'failed',
      expect.objectContaining({ code: 'REPOSITORY_ANALYSIS_TIMEOUT' }),
    );
    expect(harness.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'repository.analysis.fail',
      status: 'failed',
    }));
  });

  it('cleans the checkout and records the active stage on parser failure', async () => {
    const harness = createHarness(1_000);
    const cleanup = jest.fn();
    harness.git.checkout.mockResolvedValue({ root: '/tmp/repository', cleanup });
    harness.inventory.inventory.mockResolvedValue({
      root: '/tmp/repository',
      files: [],
      entries: [],
      totalFiles: 0,
      totalBytes: 0,
    });
    harness.parser.parse.mockImplementation(() => {
      throw new Error('parser exploded');
    });

    await execute(harness.worker);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(harness.stages.fail).toHaveBeenCalledWith(
      RUN.id,
      'detect',
      'REPOSITORY_ANALYSIS_FAILED',
      expect.any(String),
    );
    expect(harness.runs.terminal).toHaveBeenCalledWith(
      RUN.id,
      'failed',
      expect.objectContaining({ code: 'REPOSITORY_ANALYSIS_FAILED' }),
    );
  });
});
