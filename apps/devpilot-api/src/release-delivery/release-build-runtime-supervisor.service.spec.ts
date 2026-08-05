import {
  ReleaseBuildCanceledError,
  ReleaseBuildRunTimeoutError,
  ReleaseBuildRuntimeSupervisorService,
} from "./release-build-runtime-supervisor.service";

describe("ReleaseBuildRuntimeSupervisorService", () => {
  it("never exceeds the configured single-process concurrency", async () => {
    const supervisor = service(2, 5_000);
    const gates = Array.from({ length: 4 }, deferred);
    let active = 0;
    let maximum = 0;
    const runs = gates.map((gate) =>
      supervisor.run(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await gate.promise;
        active -= 1;
      }),
    );
    await tick();
    expect(active).toBe(2);
    gates[0].resolve();
    gates[1].resolve();
    await tick();
    expect(active).toBe(2);
    gates[2].resolve();
    gates[3].resolve();
    await Promise.all(runs);
    expect(maximum).toBe(2);
  });

  it("aborts a bound BuildRun with a distinct cancellation reason", async () => {
    const supervisor = service(1, 5_000);
    const started = deferred();
    const persistAbort = jest.fn().mockResolvedValue(undefined);
    const run = supervisor.run(async (scope) => {
      await scope.bind("run-1", persistAbort);
      started.resolve();
      await aborted(scope.signal);
    });
    await started.promise;
    await expect(supervisor.cancel("run-1")).resolves.toBe(true);
    await expect(run).rejects.toBeInstanceOf(ReleaseBuildCanceledError);
    expect(persistAbort).toHaveBeenCalledTimes(1);
  });

  it("applies a whole-run timeout", async () => {
    const supervisor = service(1, 20);
    const run = supervisor.run(async (scope) => aborted(scope.signal));
    await expect(run).rejects.toBeInstanceOf(ReleaseBuildRunTimeoutError);
  });

  it("returns at the deadline but retains capacity until ignored work settles", async () => {
    const supervisor = service(1, 20);
    const ignored = deferred();
    const first = supervisor.run(async () => ignored.promise);
    await expect(first).rejects.toBeInstanceOf(ReleaseBuildRunTimeoutError);
    let secondStarted = false;
    const second = supervisor.run(async () => {
      secondStarted = true;
    });
    await tick();
    expect(secondStarted).toBe(false);
    ignored.resolve();
    await second;
    expect(secondStarted).toBe(true);
  });
});

function service(maxConcurrency: number, runTimeoutMs: number) {
  return new ReleaseBuildRuntimeSupervisorService({
    maxConcurrency,
    runTimeoutMs,
  } as never);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function aborted(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}
