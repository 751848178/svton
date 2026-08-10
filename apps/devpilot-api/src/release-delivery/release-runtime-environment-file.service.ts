import { Injectable } from "@nestjs/common";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatReleaseRuntimeEnvironment } from "./release-runtime-environment.utils";
import type { ExactManifestDeploymentInput } from "./release-deployment-provider.types";
import { releaseWorkloadEnvironment } from "./release-component-environment";

@Injectable()
export class ReleaseRuntimeEnvironmentFileService {
  async useComponents<T>(
    input: ExactManifestDeploymentInput,
    action: (paths: Record<string, string>) => Promise<T>,
  ) {
    const scope = await mkdtemp(join(tmpdir(), "devpilot-runtime-env-"));
    try {
      const paths: Record<string, string> = {};
      const services = new Map(
        (input.workload?.services ?? []).map((service) => [
          service.componentKey,
          service,
        ]),
      );
      const componentKeys = [...new Set([
        ...services.keys(),
        ...Object.keys(input.componentEnvironments ?? {}),
      ])].sort();
      for (const componentKey of componentKeys) {
        const path = join(scope, `${componentKey}.env`);
        const service = services.get(componentKey);
        const environment = service
          ? releaseWorkloadEnvironment(
              {
                globalEnvironment: input.globalEnvironment ?? {},
                componentEnvironments: input.componentEnvironments ?? {},
                runtimePaths: {},
              },
              service,
            )
          : {
              ...(input.globalEnvironment ?? {}),
              ...(input.componentEnvironments?.[componentKey] ?? {}),
            };
        await writeFile(
          path,
          `${formatReleaseRuntimeEnvironment(environment)}\n`,
          { mode: 0o600 },
        );
        paths[componentKey] = path;
      }
      return await action(paths);
    } finally {
      await rm(scope, { recursive: true, force: true });
    }
  }
}
