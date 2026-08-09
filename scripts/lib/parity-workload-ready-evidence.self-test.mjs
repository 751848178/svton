#!/usr/bin/env node
import assert from "node:assert/strict";
import { workloadReadyEvidenceChecks } from "./parity-workload-ready-evidence.mjs";

const valid = {
  status: "passed",
  inputHash: "a".repeat(64),
  serviceCount: 2,
  services: [{ serviceId: "service-a" }, { serviceId: "service-b" }],
};

assertAccepted(valid);
for (const mutate of [
  (value) => { value.status = "failed"; },
  (value) => { value.inputHash = "invalid"; },
  (value) => { value.serviceCount = 0; },
  (value) => { value.serviceCount = 3; },
  (value) => { value.services = null; },
]) {
  const drifted = structuredClone(valid);
  mutate(drifted);
  assertRejected(drifted);
}

function assertAccepted(value) {
  assert.deepEqual(
    workloadReadyEvidenceChecks(value).filter((item) => item.pass !== true),
    [],
  );
}

function assertRejected(value) {
  assert.ok(
    workloadReadyEvidenceChecks(value).some((item) => item.pass !== true),
  );
}

process.stdout.write("workload-ready evidence self-test passed\n");
