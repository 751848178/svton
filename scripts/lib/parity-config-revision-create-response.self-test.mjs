#!/usr/bin/env node
import assert from "node:assert/strict";
import { requireConfigRevisionCreateResponse } from "./parity-config-revision-create-response.mjs";

const valid = {
  environment: { currentConfigRevisionId: "revision-r3" },
  revision: { id: "revision-r3", revision: 3, current: true },
};
assert.deepEqual(requireConfigRevisionCreateResponse(valid), {
  id: "revision-r3",
  revision: 3,
});

for (const invalid of [
  undefined,
  {},
  { id: "revision-r3", revision: 3, current: true },
  { ...valid, revision: { ...valid.revision, id: "" } },
  { ...valid, revision: { ...valid.revision, revision: "3" } },
  { ...valid, revision: { ...valid.revision, current: false } },
  { ...valid, environment: {} },
  {
    ...valid,
    environment: { currentConfigRevisionId: "revision-r2" },
  },
]) {
  assert.throws(
    () => requireConfigRevisionCreateResponse(invalid),
    /PARITY_CONFIG_REVISION_CREATE_RESPONSE_INVALID/,
  );
}

process.stdout.write("config revision create response self-test passed\n");
