import { predicate } from "./parity-e2e-evidence.mjs";
import { NEGATIVE_CHECKS_A } from "./parity-negative-e2e-checks-a.mjs";
import { NEGATIVE_CHECKS_B } from "./parity-negative-e2e-checks-b.mjs";
import { NEGATIVE_CHECKS_C } from "./parity-negative-e2e-checks-c.mjs";

const base = ["history-context", "preflight", "login", "fixtures"];
const ac = (...steps) => [...base, ...steps];

export const NEGATIVE_AC_MAPPING = {
  "AC-E2E-024": ac("ac-024-build-no-repo-rejected", "ac-024-db-state"),
  "AC-E2E-025": ac(
    "ac-025-setup-failed-connection",
    "ac-025-build-gate-rejected",
    "ac-025-cleanup",
  ),
  "AC-E2E-026": ac(
    "ac-026-capability-unavailable",
    "ac-026-preview-rejected",
    "ac-026-confirm-rejected",
  ),
  "AC-E2E-027": ac(
    "ac-027-cross-project-manifest",
    "ac-027-cross-order-manifest",
  ),
  "AC-E2E-028": ac(
    "ac-028-tamper-digest",
    "ac-028-deploy-rejected",
    "ac-028-restore-digest",
  ),
  "AC-E2E-029": ac(
    "ac-029-setup",
    "ac-029-confirm-at-r2",
    "ac-029-create-r3-drift",
    "ac-029-old-confirm-execute-rejected",
    "ac-029-cleanup",
  ),
  "AC-E2E-030": ac(
    "ac-030-rejected-approval",
    "ac-030-expired-approval",
    "ac-030-consumed-approval",
  ),
  "AC-E2E-031": ac(
    "ac-031-same-idempotency-key",
    "ac-031-different-idempotency-keys",
    "ac-031-approve-winner",
    "ac-031-refresh-gate-evidence",
    "ac-031-concurrent-execute",
    "ac-031-capture-pointer",
  ),
  "AC-E2E-032": ac(
    "ac-032-setup-broken-health",
    "ac-032-refresh-gate-evidence",
    "ac-032-execute-health-fail",
    "ac-032-db-state",
    "ac-032-restore-service",
  ),
  "AC-E2E-033": ac(
    "ac-033-create-r4-probe-404",
    "ac-033-refresh-gate-evidence",
    "ac-033-execute-probe-fail",
    "ac-033-db-state",
    "ac-033-restore-config",
  ),
  "AC-E2E-034": ac(
    "ac-034-member-read-allowed",
    "ac-034-member-execute-rejected",
    "ac-034-cross-team-read-rejected",
    "ac-034-db-state",
  ),
  "AC-E2E-035": ac("ac-035-secret-scan"),
};

const checks = {
  ...NEGATIVE_CHECKS_A,
  ...NEGATIVE_CHECKS_B,
  ...NEGATIVE_CHECKS_C,
};

export function negativeStepChecks(name, result) {
  const verify = checks[name];
  return verify ? verify(result) : [predicate("registeredStep", false, name)];
}
