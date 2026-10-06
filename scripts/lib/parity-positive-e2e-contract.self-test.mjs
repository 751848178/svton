import assert from "node:assert/strict";
import {
  POSITIVE_AC_MAPPING,
  positiveAcMappingFor,
} from "./parity-positive-e2e-contract.mjs";

const basic = positiveAcMappingFor("basic_v1");
assert.deepEqual(Object.keys(basic), [
  "AC-E2E-007",
  "AC-E2E-008",
  "AC-E2E-009",
  "AC-E2E-010",
  "AC-E2E-011",
  "AC-E2E-012",
]);
assert.equal(Object.values(basic).flat().includes("staging-deploy"), true);
assert.equal(Object.values(basic).flat().includes("production-execute"), false);
assert.equal(positiveAcMappingFor("governed_v1"), POSITIVE_AC_MAPPING);
console.log("parity positive E2E contract self-test passed");
