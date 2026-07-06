import { LogCollectionRunExecutionService } from "./log-collection-run-execution.service";
import { LogEntryAppendService } from "./log-entry-append.service";
import { LogRetentionCleanupService } from "./log-retention-cleanup.service";
import { LogStreamMutationService } from "./log-stream-mutation.service";
import { LogStreamQueryService } from "./log-stream-query.service";
import { LogStreamWriteOrchestrationService } from "./log-stream-write-orchestration.service";

describe("LogStreamWriteOrchestrationService", () => {
  const activeStream = {
    id: "stream-1",
    status: "active",
    sourceType: "manual",
  };

  function createService(stream = activeStream) {
    const logStreamQueryService = {
      get: jest.fn().mockResolvedValue(stream),
    };
    const logCollectionRunExecutionService = {
      execute: jest.fn().mockResolvedValue({ id: "run-1" }),
    };
    const logStreamMutationService = {
      update: jest.fn().mockResolvedValue({ id: "stream-1" }),
    };
    const logEntryAppendService = {
      append: jest.fn().mockResolvedValue({ entries: [] }),
    };
    const logRetentionCleanupService = {
      cleanup: jest.fn().mockResolvedValue({ id: "retention-run-1" }),
    };
    const service = new LogStreamWriteOrchestrationService(
      logStreamQueryService as unknown as LogStreamQueryService,
      logCollectionRunExecutionService as unknown as LogCollectionRunExecutionService,
      logStreamMutationService as unknown as LogStreamMutationService,
      logEntryAppendService as unknown as LogEntryAppendService,
      logRetentionCleanupService as unknown as LogRetentionCleanupService,
    );
    return {
      service,
      logStreamQueryService,
      logCollectionRunExecutionService,
      logStreamMutationService,
      logEntryAppendService,
      logRetentionCleanupService,
    };
  }

  it("delegates active stream collection after scoped lookup", async () => {
    const { service, logCollectionRunExecutionService } = createService();

    await service.collect("team-1", "user-1", "stream-1", { dryRun: true });

    expect(logCollectionRunExecutionService.execute).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      activeStream,
      { dryRun: true },
    );
  });

  it("blocks collection for archived streams", async () => {
    const { service, logCollectionRunExecutionService } = createService({
      ...activeStream,
      status: "archived",
    });

    await expect(
      service.collect("team-1", "user-1", "stream-1", {}),
    ).rejects.toThrow("归档的日志流不能发起采集");
    expect(logCollectionRunExecutionService.execute).not.toHaveBeenCalled();
  });

  it("blocks manual append for archived streams", async () => {
    const { service, logEntryAppendService } = createService({
      ...activeStream,
      status: "archived",
    });

    await expect(
      service.append("team-1", "user-1", "stream-1", {
        level: "info",
        message: "hello",
      }),
    ).rejects.toThrow("归档的日志流不能追加日志");
    expect(logEntryAppendService.append).not.toHaveBeenCalled();
  });

  it("delegates update and retention cleanup with the scoped stream", async () => {
    const { service, logStreamMutationService, logRetentionCleanupService } =
      createService();

    await service.update("team-1", "stream-1", { name: "renamed" });
    await service.cleanupRetention("team-1", null, "stream-1", {
      dryRun: true,
    });

    expect(logStreamMutationService.update).toHaveBeenCalledWith(activeStream, {
      name: "renamed",
    });
    expect(logRetentionCleanupService.cleanup).toHaveBeenCalledWith(
      "team-1",
      null,
      activeStream,
      { dryRun: true },
    );
  });
});
