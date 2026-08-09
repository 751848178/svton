import { rm } from "node:fs/promises";
import { cleanupOwnedC5Resources } from "./parity-isolated-c5-cleanup.mjs";
import {
  assertNoOwnedBuildxBuilder,
  destroyOwnedBuildxBuilder,
} from "./parity-runtime-builder.mjs";
import { assertNoRuntimeResources } from "./parity-runtime-resource-ownership.mjs";

export function cleanupPreparedC5Runtime(input) {
  const { runtime, environment, expectedImageIds, destroyRuntime } = input;
  return cleanupOwnedC5Resources({
    destroyBuilder: () => destroyOwnedBuildxBuilder(runtime),
    destroyRuntime: () => destroyRuntime(environment),
    removeFixture: () =>
      rm(environment.PARITY_FIXTURE_GIT_ROOT, {
        recursive: true,
        force: true,
      }),
    assertNoBuilder: () => assertNoOwnedBuildxBuilder(runtime),
    assertNoRuntimeResources: () =>
      assertNoRuntimeResources(runtime, undefined, expectedImageIds),
  });
}
