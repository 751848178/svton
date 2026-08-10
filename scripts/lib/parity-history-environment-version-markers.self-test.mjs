import assert from "node:assert/strict";
import { environmentVersionMarkers } from "./parity-history-environment-version-markers.mjs";

const expected = {
  stagingUpgradeVersionId: "staging-upgrade",
  stagingRecoveryVersionId: "staging-recovery",
  productionUpgradeVersionId: "production-upgrade",
  productionRecoveryVersionId: "production-recovery",
};
const valid = environmentVersionMarkers({
  text: "环境版本 环境变更记录",
  html: [
    row("staging", "upgrade", expected.stagingUpgradeVersionId),
    row("staging", "recovery", expected.stagingRecoveryVersionId, true),
    row("production", "upgrade", expected.productionUpgradeVersionId),
    row("production", "recovery", expected.productionRecoveryVersionId, true),
  ].join(""),
  expected,
});
assert.ok(Object.values(valid).every(Boolean));

const oneRole = environmentVersionMarkers({
  text: "环境版本 环境变更记录 升级 回退 成功",
  html: row("staging", "upgrade", expected.stagingUpgradeVersionId, true),
  expected,
});
assert.equal(oneRole.stagingUpgradeKind, true);
assert.equal(oneRole.productionUpgradeKind, false);
assert.equal(oneRole.stagingRecoveryKind, false);
assert.equal(oneRole.productionRecoveryKind, false);
assert.equal(oneRole.currentSuccess, false);
const wrongIdentity = environmentVersionMarkers({
  text: "环境版本 环境变更记录",
  html: row("production", "upgrade", "wrong-version"),
  expected,
});
assert.equal(wrongIdentity.productionUpgradeKind, false);
assert.throws(
  () =>
    environmentVersionMarkers({
      text: "环境版本 环境变更记录",
      html: "",
      expected: {
        ...expected,
        productionRecoveryVersionId: expected.productionUpgradeVersionId,
      },
    }),
  /expected-distinctness/,
);

console.log("parity history environment version markers self-test passed");

function row(role, kind, versionId, current = false) {
  return `<tr data-environment-role="${role}" data-version-kind="${kind}" data-version-id="${versionId}" data-version-current="${current}"><td>${current ? "成功" : "历史记录"}</td></tr>`;
}
