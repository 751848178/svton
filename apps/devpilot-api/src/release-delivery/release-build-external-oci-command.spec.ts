import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

const spawn = jest.fn((_executable?: unknown, _args?: unknown) => {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough; stderr: PassThrough; kill: jest.Mock;
  };
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = jest.fn();
  return child;
});
jest.mock("node:child_process", () => ({
  spawn: (executable: unknown, args: unknown) => spawn(executable, args),
}));

import { runExternalOciCommand } from "./release-build-external-oci-command";

describe("external OCI command cancellation", () => {
  beforeEach(() => spawn.mockClear());

  it("does not spawn when already aborted", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(runExternalOciCommand("/usr/bin/docker", ["ps"], 1_000,
      controller.signal)).rejects.toThrow("canceled");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("kills a spawned command when canceled", async () => {
    const controller = new AbortController();
    const pending = runExternalOciCommand("/usr/bin/docker", ["start"], 1_000,
      controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow("canceled");
    expect(spawn.mock.results[0].value.kill).toHaveBeenCalledWith("SIGKILL");
  });
});
