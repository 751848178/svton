export const POSITIVE_AC_MAPPING = Object.freeze({
  "AC-E2E-007": Object.freeze([
    "preflight",
    "intake-draft",
    "intake-connect",
    "intake-analyze",
    "intake-contract",
    "intake-review",
    "intake-finalize",
  ]),
  "AC-E2E-008": Object.freeze(["intake-finalize", "baselines-verified"]),
  "AC-E2E-009": Object.freeze([
    "env-r1-current",
    "env-targets",
    "env-save-r2-staging",
    "env-save-r2-production",
  ]),
  "AC-E2E-010": Object.freeze(["release-order"]),
  "AC-E2E-011": Object.freeze(["build"]),
  "AC-E2E-012": Object.freeze(["staging-deploy"]),
  "AC-E2E-013": Object.freeze([
    "production-preview",
    "production-confirm",
    "approval-list",
    "approval-review",
    "production-execute",
  ]),
  "AC-E2E-014": Object.freeze([
    "production-current-version",
    "release-run-final",
  ]),
  "AC-E2E-015": Object.freeze(["final-site-http"]),
});

export const POSITIVE_ACCEPTANCE_IDS = Object.freeze(
  Object.keys(POSITIVE_AC_MAPPING),
);
