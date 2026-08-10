import { recordC5BuilderLifecycle } from "./parity-isolated-c5-resource-identity.mjs";
import {
  assertNoOwnedBuildxBuilder,
  createOwnedBuildxBuilder,
  destroyOwnedBuildxBuilder,
} from "./parity-runtime-builder.mjs";

export async function runOwnedBuilderLifecycle({ context, runtime, action }) {
  const created = createOwnedBuildxBuilder(runtime);
  await recordC5BuilderLifecycle(context.manifestPath, runtime, {
    ...created,
    capturedAt: new Date().toISOString(),
  });
  await action();
  const removed = destroyOwnedBuildxBuilder(runtime);
  const absence = assertNoOwnedBuildxBuilder(runtime);
  const lifecycle = {
    status: "removed",
    name: runtime.builderName,
    created,
    removed,
    absence,
    verifiedAt: new Date().toISOString(),
  };
  await recordC5BuilderLifecycle(context.manifestPath, runtime, lifecycle);
  return lifecycle;
}
