import { z } from "zod";
import { booleanString, positiveInt } from "./env-schema-primitives";

export const releaseBuildEnvSchema = z.object({
  RELEASE_BUILD_EXECUTION_ENABLED: booleanString.default("false"),
  RELEASE_BUILD_EXECUTOR_PROFILE: z
    .enum([
      "disabled",
      "controlled-local-v1",
      "controlled-local-acceptance-v2",
    ])
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
  RELEASE_BUILD_MAX_ARTIFACT_FILES: positiveInt(1).default(10000),
  RELEASE_BUILD_ARTIFACT_ROOT: z.string().optional(),
  RELEASE_BUILD_EVIDENCE_ROOT: z.string().optional(),
  RELEASE_BUILD_UNTRUSTED_WORKER_PROVIDER: z
    .enum(["disabled", "external-oci-launcher-v1"])
    .default("disabled"),
  RELEASE_BUILD_WORKER_INPUT_ROOT: z.string().optional(),
  RELEASE_BUILD_WORKER_OUTPUT_ROOT: z.string().optional(),
  RELEASE_BUILD_WORKER_HMAC_SECRET_FILE: z.string().optional(),
  RELEASE_BUILD_LAUNCHER_PROOF_FILE: z.string().optional(),
  RELEASE_BUILD_LAUNCHER_JOB_IMAGE: z.string().optional(),
  RELEASE_BUILD_LAUNCHER_DOCKER_EXECUTABLE: z.string().optional(),
  RELEASE_BUILD_LAUNCHER_INSTANCE_LABEL: z.string().optional(),
  RELEASE_BUILD_SUPPLY_PROOF_FILE: z.string().optional(),
  RELEASE_BUILD_WORKER_POLL_INTERVAL_MS: positiveInt(1).default(250),
  RELEASE_BUILD_WORKER_SHARED_GID: positiveInt(1).default(2000),
  RELEASE_STAGING_DEPLOYMENT_ENABLED: booleanString.default("false"),
  RELEASE_DEPLOYMENT_PROVIDER_PROFILE: z
    .enum(["disabled", "local-filesystem-v1", "ssh-v1"])
    .default("disabled"),
  RELEASE_DEPLOYMENT_SSH_HOST: z.string().optional(),
  RELEASE_DEPLOYMENT_SSH_PORT: positiveInt(1).default(22),
  RELEASE_DEPLOYMENT_SSH_USERNAME: z.string().optional(),
  RELEASE_DEPLOYMENT_SSH_PASSWORD: z.string().optional(),
  RELEASE_DEPLOYMENT_SSH_PRIVATE_KEY: z.string().optional(),
  RELEASE_DEPLOYMENT_SSH_ROOT: z.string().optional(),
  RELEASE_STAGING_DEPLOYMENT_TIMEOUT_MS: positiveInt(1).default(120000),
  RELEASE_STAGING_DEPLOYMENT_ROOT: z.string().optional(),
});
