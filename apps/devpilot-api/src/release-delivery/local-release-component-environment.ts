import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExactManifestDeploymentInput } from "./release-deployment-provider.types";
import { releaseWorkloadEnvironment } from "./release-component-environment";
import { formatReleaseRuntimeEnvironment } from "./release-runtime-environment.utils";

export async function writeLocalComponentEnvironments(
  input: ExactManifestDeploymentInput,
  temporaryRoot: string,
  releaseRoot: string,
) {
  const directory = join(temporaryRoot, ".devpilot", "env");
  await rm(join(temporaryRoot, ".devpilot"), { recursive: true, force: true });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const runtimePaths: Record<string, string> = {};
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
    const filename = componentFilename(componentKey);
    const temporaryPath = join(directory, filename);
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
      temporaryPath,
      `${formatReleaseRuntimeEnvironment(environment)}\n`,
      { mode: 0o600, flag: "wx" },
    );
    await chmod(temporaryPath, 0o600);
    runtimePaths[componentKey] = join(
      releaseRoot,
      ".devpilot",
      "env",
      filename,
    );
  }
  return runtimePaths;
}

export function componentFilename(componentKey: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(componentKey)) {
    throw new Error("工作负载组件标识无法用于环境文件");
  }
  return `${componentKey}.env`;
}
