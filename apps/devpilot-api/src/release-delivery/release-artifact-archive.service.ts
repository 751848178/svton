import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";

export abstract class ReleaseArtifactArchivePort {
  abstract list(path: string, timeoutMs: number): Promise<string[]>;
  abstract extract(
    path: string,
    target: string,
    timeoutMs: number,
  ): Promise<void>;
}

@Injectable()
export class UnzipReleaseArtifactArchiveService extends ReleaseArtifactArchivePort {
  async list(path: string, timeoutMs: number) {
    const output = await execute(["-Z1", path], timeoutMs);
    return output.stdout.split(/\r?\n/).filter(Boolean);
  }

  async extract(path: string, target: string, timeoutMs: number) {
    await execute(["-qq", path, "-d", target], timeoutMs);
  }
}

function execute(args: string[], timeout: number) {
  return new Promise<{ stdout: string; stderr: string }>(
    (resolvePromise, reject) => {
      execFile(
        "unzip",
        args,
        { timeout, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolvePromise({ stdout, stderr });
        },
      );
    },
  );
}
