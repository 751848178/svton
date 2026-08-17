import { RepositoryAnalysisWorkerService } from './repository-analysis-worker.service';
import { archivedProjectWriteError } from '../project/project-archived-write.error';

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
    start: jest.fn().mockResolvedValue({ state: 'claimed' }),
    extendWorkerLease: jest.fn().mockResolvedValue({ count: 1 }),
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
  const completion = { succeed: jest.fn(), fail: jest.fn() };
  const finalization = { fail: jest.fn() };
  const worker = new RepositoryAnalysisWorkerService(
    config as never,
    runs as never,
    stages as never,
    credentials as never,
    git as never,
    inventory as never,
    parser as never,
    suggestions as never,
    completion as never,
    finalization as never,
  );
  return { worker, runs, stages, git, inventory, parser, audit, completion, finalization };
}

async function execute(worker: RepositoryAnalysisWorkerService) {
  await (worker as unknown as { execute: (runId: string) => Promise<void> })
    .execute(RUN.id);
}

describe('RepositoryAnalysisWorkerService failures', () => {
  afterEach(() => jest.useRealTimers());

  it('retries detached storage failures until the run can be read', async () => {
    jest.useFakeTimers();
    const harness = createHarness(1_000);
    harness.runs.findWorkerRun
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockRejectedValueOnce(new Error('database still unavailable'))
      .mockResolvedValueOnce(null);

    harness.worker.enqueue(RUN.id);
    await jest.runAllTimersAsync();

    expect(harness.runs.findWorkerRun).toHaveBeenCalledTimes(3);
  });

  it('leaves an archived queued run untouched when worker start is rejected', async () => {
    const harness = createHarness(1_000);
    harness.runs.start.mockRejectedValue(archivedProjectWriteError());

    await execute(harness.worker);

    expect(harness.stages.start).not.toHaveBeenCalled();
    expect(harness.stages.fail).not.toHaveBeenCalled();
    expect(harness.stages.cancelRemaining).not.toHaveBeenCalled();
    expect(harness.runs.terminal).not.toHaveBeenCalled();
    expect(harness.audit.record).not.toHaveBeenCalled();
    expect(harness.git.checkout).not.toHaveBeenCalled();
  });

  it('leaves a run untouched when another worker owns the lease', async () => {
    const harness = createHarness(1_000);
    harness.runs.start.mockResolvedValue({ state: 'terminal' });

    await execute(harness.worker);

    expect(harness.stages.start).not.toHaveBeenCalled();
    expect(harness.completion.succeed).not.toHaveBeenCalled();
    expect(harness.finalization.fail).not.toHaveBeenCalled();
    expect(harness.git.checkout).not.toHaveBeenCalled();
  });

  it('marks a whole-run timeout failed and cancels remaining stages', async () => {
    const harness = createHarness(5);
    harness.git.checkout.mockImplementation(
      (_url: string, _branch: string, _sha: string, _credential: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    );

    await execute(harness.worker);

    expect(harness.finalization.fail).toHaveBeenCalledWith(expect.objectContaining({
      runId: RUN.id,
      currentStage: 'checkout',
      error: expect.anything(),
      timedOut: true,
      aborted: true,
      cancelRequested: false,
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
    expect(harness.finalization.fail).toHaveBeenCalledWith(expect.objectContaining({
      currentStage: 'detect',
      error: expect.any(Error),
    }));
  });

  it('requeues when completion fencing rejects failure finalization', async () => {
    jest.useFakeTimers();
    const harness = createHarness(1_000);
    harness.parser.parse.mockImplementation(() => { throw new Error('parser exploded'); });
    harness.git.checkout.mockResolvedValue({ root: '/tmp/repository', cleanup: jest.fn() });
    harness.inventory.inventory.mockResolvedValue({
      root: '/tmp/repository', files: [], entries: [], totalFiles: 0, totalBytes: 0,
    });
    harness.finalization.fail.mockRejectedValueOnce(
      new Error('repository analysis worker lease lost'),
    );
    harness.runs.findWorkerRun.mockResolvedValueOnce(RUN).mockResolvedValueOnce(null);

    harness.worker.enqueue(RUN.id);
    await jest.runAllTimersAsync();

    expect(harness.finalization.fail).toHaveBeenCalledTimes(1);
    expect(harness.runs.findWorkerRun).toHaveBeenCalledTimes(2);
  });
});
