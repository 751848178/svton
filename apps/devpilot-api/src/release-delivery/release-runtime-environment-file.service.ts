import { Injectable } from "@nestjs/common";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatEnvFile } from "../deployment/deployment-env-heredoc.utils";

@Injectable()
export class ReleaseRuntimeEnvironmentFileService {
  async use<T>(
    environment: Record<string, string>,
    action: (path: string) => Promise<T>,
  ) {
    const scope = await mkdtemp(join(tmpdir(), "devpilot-runtime-env-"));
    const path = join(scope, "runtime.env");
    try {
      await writeFile(path, `${formatEnvFile(environment)}\n`, { mode: 0o600 });
      return await action(path);
    } finally {
      await rm(scope, { recursive: true, force: true });
    }
  }
}
