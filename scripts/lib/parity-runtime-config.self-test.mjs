import assert from "node:assert/strict";
import {
  parityComposeEnvironment,
  parityRuntimeConfig,
  requireVerifiedRuntimeIdentity,
} from "./parity-runtime-config.mjs";

const isolated = parityRuntimeConfig({
  PARITY_COMPOSE_PROJECT: "devpilot-parity-c5-a1b2c3d4-1234abcd",
  PARITY_DATABASE_NAME: "devpilot_parity_a1b2c3d4_1234abcd",
  PARITY_WEB_PORT: "45131",
  PARITY_API_PORT: "45132",
  PARITY_MYSQL_PORT: "45334",
  PARITY_REDIS_PORT: "45384",
  PARITY_SSH_PORT: "45222",
  PARITY_TARGET_PORT: "45992",
  PARITY_API_IMAGE: "devpilot-parity-api:a1b2c3d4-1234abcd",
  PARITY_WEB_IMAGE: "devpilot-parity-web:a1b2c3d4-1234abcd",
  PARITY_SOURCE_REVISION: `a1b2c3d4${"a".repeat(32)}`,
  PARITY_SOURCE_TREE_SHA256: "b".repeat(64),
  PARITY_RUNTIME_ID: "c5-a1b2c3d4-1234abcd",
});
assert.equal(isolated.apiBase, "http://127.0.0.1:45132/api");
assert.equal(isolated.webOrigin, "http://localhost:45131");
assert.equal(
  isolated.databaseUrl,
  "mysql://root:password@127.0.0.1:45334/devpilot_parity_a1b2c3d4_1234abcd",
);
assert.equal(requireVerifiedRuntimeIdentity(isolated), true);
assert.equal(parityComposeEnvironment(isolated).PARITY_TARGET_PORT, "45992");

for (const env of [
  { PARITY_COMPOSE_PROJECT: "devpilot-parity;down" },
  { PARITY_COMPOSE_PROJECT: "unowned" },
  { PARITY_DATABASE_NAME: "mysql" },
  { PARITY_API_PORT: "80" },
  { PARITY_API_PORT: "4131" },
  { PARITY_API_IMAGE: "latest" },
]) {
  assert.throws(
    () => parityRuntimeConfig(env),
    /PARITY_RUNTIME_CONFIG_INVALID/,
  );
}
assert.throws(
  () => requireVerifiedRuntimeIdentity(parityRuntimeConfig({})),
  /source-revision/,
);

console.log("parity runtime config self-test passed");
