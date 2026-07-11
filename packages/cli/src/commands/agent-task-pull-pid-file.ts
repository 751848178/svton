import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

type ProcessLivenessCheck = (pid: number) => boolean;

export function installAgentTaskPullPidFile(
  path: string,
  pid = process.pid,
  isProcessAlive: ProcessLivenessCheck = isLiveProcess,
) {
  const pidFile = resolve(path);
  assertPidFileAvailable(pidFile, isProcessAlive);
  mkdirSync(dirname(pidFile), { recursive: true });
  const value = `${pid}\n`;
  writeFileSync(pidFile, value, "utf8");

  return () => {
    try {
      if (readFileSync(pidFile, "utf8") === value) {
        rmSync(pidFile);
      }
    } catch {
      // Ignore cleanup races; supervisors should treat stale files separately.
    }
  };
}

function assertPidFileAvailable(
  pidFile: string,
  isProcessAlive: ProcessLivenessCheck,
) {
  if (!existsSync(pidFile)) {
    return;
  }

  const existingPid = Number(readFileSync(pidFile, "utf8").trim());
  if (
    Number.isInteger(existingPid) &&
    existingPid > 0 &&
    isProcessAlive(existingPid)
  ) {
    throw new Error(
      `Task-pull pid file is already owned by live process ${existingPid}: ${pidFile}`,
    );
  }
}

function isLiveProcess(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EPERM"
    );
  }
}
