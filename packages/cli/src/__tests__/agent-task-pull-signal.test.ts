import { EventEmitter } from "events";
import { createAgentTaskPullStopController } from "../commands/agent-task-pull-signal";

class ProcessStub extends EventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }
}

describe("agent task-pull signal controller", () => {
  it("aborts on SIGINT and removes temporary handlers on cleanup", () => {
    const processStub = new ProcessStub();
    const controller = createAgentTaskPullStopController(processStub);

    processStub.emit("SIGINT");

    expect(controller.signal.aborted).toBe(true);
    expect(processStub.listenerCount("SIGINT")).toBe(1);
    expect(processStub.listenerCount("SIGTERM")).toBe(1);

    controller.cleanup();

    expect(processStub.listenerCount("SIGINT")).toBe(0);
    expect(processStub.listenerCount("SIGTERM")).toBe(0);
  });
});
