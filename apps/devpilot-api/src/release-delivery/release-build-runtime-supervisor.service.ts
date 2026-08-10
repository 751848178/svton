import {
  ConflictException,
  Injectable,
  OnApplicationShutdown,
  RequestTimeoutException,
} from "@nestjs/common";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";

export class ReleaseBuildCanceledError extends ConflictException {
  constructor() {
    super({
      code: "BUILD_COMMAND_CANCELED",
      message: "Build execution canceled",
    });
    this.name = "ReleaseBuildCanceledError";
  }
}

export class ReleaseBuildRunTimeoutError extends RequestTimeoutException {
  constructor() {
    super({
      code: "BUILD_RUN_TIMEOUT",
      message: "Build execution timed out",
    });
    this.name = "ReleaseBuildRunTimeoutError";
  }
}

export interface ReleaseBuildRuntimeScope {
  signal: AbortSignal;
  bind(
    buildRunId: string,
    persistAbort: (signal: AbortSignal) => Promise<void>,
  ): Promise<void>;
}

interface ActiveBuildRun {
  controller: AbortController;
  persistAbort: (signal: AbortSignal) => Promise<void>;
  persistence?: Promise<void>;
}

@Injectable()
export class ReleaseBuildRuntimeSupervisorService implements OnApplicationShutdown {
  private activeSlots = 0;
  private readonly activeRuns = new Map<string, ActiveBuildRun>();
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly runtime: ReleaseBuildRuntimeProfileService) {}

  async run<T>(task: (scope: ReleaseBuildRuntimeScope) => Promise<T>) {
    await this.acquire();
    const controller = new AbortController();
    let buildRunId: string | undefined;
    let activeRun: ActiveBuildRun | undefined;
    const timeout = setTimeout(() => {
      controller.abort(new ReleaseBuildRunTimeoutError());
    }, this.runtime.runTimeoutMs);
    timeout.unref();
    const abort = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => {
          const persistence = activeRun
            ? this.persistAbort(activeRun)
            : Promise.resolve();
          void persistence.then(
            () => reject(abortReason(controller.signal)),
            () => reject(abortReason(controller.signal)),
          );
        },
        { once: true },
      );
    });
    const taskPromise = Promise.resolve().then(() =>
      task({
        signal: controller.signal,
        bind: async (id, persistAbort) => {
          if (buildRunId || this.activeRuns.has(id)) {
            throw new Error("Build runtime scope already bound");
          }
          buildRunId = id;
          activeRun = { controller, persistAbort };
          this.activeRuns.set(id, activeRun);
          if (controller.signal.aborted) {
            await this.persistAbort(activeRun);
            throw abortReason(controller.signal);
          }
        },
      }),
    );
    const finalize = () => {
      clearTimeout(timeout);
      if (buildRunId) this.activeRuns.delete(buildRunId);
      this.release();
    };
    void taskPromise.then(finalize, finalize);
    try {
      const result = await Promise.race([taskPromise, abort]);
      if (controller.signal.aborted) throw abortReason(controller.signal);
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw abortReason(controller.signal);
      throw error;
    }
  }

  async cancel(buildRunId: string) {
    const activeRun = this.activeRuns.get(buildRunId);
    if (!activeRun || activeRun.controller.signal.aborted) return false;
    activeRun.controller.abort(new ReleaseBuildCanceledError());
    await this.persistAbort(activeRun);
    return true;
  }

  async onApplicationShutdown() {
    await Promise.all(
      [...this.activeRuns.values()].map(async (activeRun) => {
        if (!activeRun.controller.signal.aborted) {
          activeRun.controller.abort(new ReleaseBuildCanceledError());
          await this.persistAbort(activeRun).catch(() => undefined);
        }
      }),
    );
  }

  private persistAbort(activeRun: ActiveBuildRun) {
    if (!activeRun.persistence) {
      activeRun.persistence = activeRun.persistAbort(
        activeRun.controller.signal,
      );
    }
    return activeRun.persistence;
  }

  private acquire() {
    if (this.activeSlots < this.runtime.maxConcurrency) {
      this.activeSlots += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolvePromise) => {
      this.waiting.push(() => {
        this.activeSlots += 1;
        resolvePromise();
      });
    });
  }

  private release() {
    this.activeSlots -= 1;
    this.waiting.shift()?.();
  }
}

function abortReason(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new ReleaseBuildCanceledError();
}
