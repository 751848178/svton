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
  "AC-E2E-008": Object.freeze([
    "intake-finalize",
    "baselines-verified",
    "delivery-fixture-claim",
  ]),
  "AC-E2E-009": Object.freeze([
    "env-r1-current",
    "env-targets",
    "env-save-r2-staging",
    "env-save-r2-production",
  ]),
  "AC-E2E-010": Object.freeze(["release-order"]),
  "AC-E2E-011": Object.freeze(["build-gate-review", "build"]),
  "AC-E2E-012": Object.freeze(["staging-deploy"]),
  "AC-E2E-013": Object.freeze([
    "production-preview",
    "production-preflight-refresh",
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

const BASIC_ACCEPTANCE_IDS = Object.freeze([
  "AC-E2E-007",
  "AC-E2E-008",
  "AC-E2E-009",
  "AC-E2E-010",
  "AC-E2E-011",
  "AC-E2E-012",
]);

export function positiveAcMappingFor(profile) {
  if (profile === "governed_v1") return POSITIVE_AC_MAPPING;
  return Object.freeze(
    Object.fromEntries(
      BASIC_ACCEPTANCE_IDS.map((id) => [id, POSITIVE_AC_MAPPING[id]]),
    ),
  );
}
