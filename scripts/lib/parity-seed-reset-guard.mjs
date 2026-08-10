import { assertOwnedRuntimeResources } from "./parity-runtime-resource-ownership.mjs";

export async function downAfterVerifiedOwnership({
  runtime,
  expectedImageIds,
  down,
  verifyOwnership = assertOwnedRuntimeResources,
}) {
  if (expectedImageIds) {
    verifyOwnership(runtime, undefined, expectedImageIds);
  }
  await down();
}
