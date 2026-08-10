import { ReleaseDeploymentProviderError } from "./release-deployment-provider.types";
import type { ReleaseStagingWorkload } from "./release-staging-workload.types";

export type ReleaseComponentEnvironments = {
  globalEnvironment: Record<string, string>;
  componentEnvironments: Record<string, Record<string, string>>;
  runtimePaths: Record<string, string>;
};

export function releaseWorkloadEnvironment(
  input: ReleaseComponentEnvironments,
  service: ReleaseStagingWorkload,
) {
  return {
    ...input.globalEnvironment,
    ...(input.componentEnvironments[service.componentKey] ?? {}),
  };
}

export function releaseWorkloadPaths(
  input: ReleaseComponentEnvironments & { releaseRoot: string },
  service: ReleaseStagingWorkload,
) {
  const runtimePath = input.runtimePaths[service.componentKey];
  if (!runtimePath) {
    throw new ReleaseDeploymentProviderError({
      code: "WORKLOAD_ENVIRONMENT_MISSING",
      message: `服务 ${service.name} 缺少独立运行时环境文件`,
      logs: [],
    });
  }
  return { releaseRoot: input.releaseRoot, runtimePath };
}

export function releaseEnvironmentSecrets(
  input: Pick<
    ReleaseComponentEnvironments,
    "globalEnvironment" | "componentEnvironments"
  >,
) {
  return Object.fromEntries(
    [
      ...Object.values(input.globalEnvironment),
      ...Object.values(input.componentEnvironments).flatMap(Object.values),
    ].map((value, index) => [`value_${index}`, value]),
  );
}
