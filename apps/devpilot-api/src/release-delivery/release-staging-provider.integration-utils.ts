import { ConfigService } from "@nestjs/config";
import type { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseStagingWorkloadService } from "./release-staging-workload.service";
import { ReleaseStagingWorkloadStateRepository } from "./release-staging-workload-state.repository";
import { ReleaseStagingRepository } from "./release-staging.repository";

export function releaseStagingProviderConfig(scope: string) {
  const values: Record<string, unknown> = {
    RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts"),
    RELEASE_STAGING_DEPLOYMENT_ROOT: join(scope, "deployments"),
    RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: 5_000,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

export function releaseStagingProviderComponent(key = "service-1") {
  return {
    key,
    name: "api",
    workingDirectory: ".",
    buildCommand: "true",
    artifactOutputs: ["dist"],
    buildEnvironment: {},
  };
}

export async function writeReleaseStagingFixture(checkout: string) {
  await mkdir(join(checkout, "dist"), { recursive: true });
  await Promise.all([
    writeFile(join(checkout, "dist", "app.txt"), "real provider target"),
    writeFile(
      join(checkout, "dist", "fail.sh"),
      "printf diagnostic-sentinel-f433 >&2\nexit 23\n",
    ),
  ]);
}

export function releaseStagingWorkloadService(prisma: PrismaClient) {
  return new ReleaseStagingWorkloadService(
    new ReleaseStagingWorkloadStateRepository(
      prisma as unknown as PrismaService,
    ),
  );
}

export function releaseStagingRepository(prisma: PrismaClient) {
  return new ReleaseStagingRepository(prisma as unknown as PrismaService);
}
