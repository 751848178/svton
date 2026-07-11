import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installAgentTaskPullPidFile } from "../commands/agent-task-pull-pid-file";

describe("installAgentTaskPullPidFile", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempPidFile() {
    const dir = mkdtempSync(join(tmpdir(), "svton-agent-pid-"));
    tempDirs.push(dir);
    return join(dir, "agent.pid");
  }

  it("writes and cleans up its own pid file", () => {
    const path = createTempPidFile();

    const cleanup = installAgentTaskPullPidFile(path, 1234, () => false);

    expect(readFileSync(path, "utf8")).toBe("1234\n");
    cleanup();
    expect(existsSync(path)).toBe(false);
  });

  it("does not remove a pid file replaced by another process", () => {
    const path = createTempPidFile();
    const cleanup = installAgentTaskPullPidFile(path, 1234, () => false);

    writeFileSync(path, "5678\n", "utf8");
    cleanup();

    expect(readFileSync(path, "utf8")).toBe("5678\n");
  });

  it("refuses to overwrite a live pid file", () => {
    const path = createTempPidFile();
    writeFileSync(path, "4321\n", "utf8");

    expect(() =>
      installAgentTaskPullPidFile(path, 1234, (pid) => pid === 4321),
    ).toThrow("already owned by live process 4321");
    expect(readFileSync(path, "utf8")).toBe("4321\n");
  });

  it("replaces a stale pid file", () => {
    const path = createTempPidFile();
    writeFileSync(path, "4321\n", "utf8");

    const cleanup = installAgentTaskPullPidFile(path, 1234, () => false);

    expect(readFileSync(path, "utf8")).toBe("1234\n");
    cleanup();
    expect(existsSync(path)).toBe(false);
  });
});
