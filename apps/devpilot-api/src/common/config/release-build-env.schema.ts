import { z } from "zod";
import { booleanString, positiveInt } from "./env-schema-primitives";

export const releaseBuildEnvSchema = z.object({
  RELEASE_BUILD_EXECUTION_ENABLED: booleanString.default("false"),
  RELEASE_BUILD_EXECUTOR_PROFILE: z
    .enum(["disabled", "controlled-local-v1"])
    .default("disabled"),
  RELEASE_BUILD_WORK_ROOT: z.string().optional(),
  RELEASE_BUILD_RUN_TIMEOUT_MS: positiveInt(1).default(900000),
  RELEASE_BUILD_COMMAND_TIMEOUT_MS: positiveInt(1).default(600000),
  RELEASE_BUILD_CANCEL_GRACE_MS: positiveInt(1).default(5000),
  RELEASE_BUILD_MAX_CONCURRENCY: positiveInt(1).default(1),
  RELEASE_BUILD_COMMAND_PATH: z
    .string()
    .min(1)
    .default("/usr/local/bin:/usr/bin:/bin"),
  RELEASE_BUILD_MAX_ARTIFACT_BYTES: positiveInt(1).default(262144000),
  RELEASE_BUILD_ARTIFACT_ROOT: z.string().optional(),
  RELEASE_STAGING_DEPLOYMENT_ENABLED: booleanString.default("false"),
  RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: positiveInt(1).default(120000),
  RELEASE_STAGING_DEPLOYMENT_ROOT: z.string().optional(),
});
