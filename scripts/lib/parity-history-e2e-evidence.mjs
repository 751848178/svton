import { predicate } from "./parity-e2e-evidence.mjs";
import { ACTION_HISTORY_STEP_CHECKS } from "./parity-history-action-checks.mjs";
import { BASE_HISTORY_STEP_CHECKS } from "./parity-history-base-checks.mjs";
import { SUMMARY_HISTORY_STEP_CHECKS } from "./parity-history-summary-checks.mjs";

export const HISTORY_AC_MAPPING = {
  "AC-E2E-016": ["build-2"],
  "AC-E2E-017": ["staging-deploy-repeat"],
  "AC-E2E-018": ["staging-upgrade"],
  "AC-E2E-019": ["staging-recovery"],
  "AC-E2E-020": [
    "production-preview",
    "production-confirm",
    "production-approve",
    "production-upgrade-execute",
  ],
  "AC-E2E-021": [
    "production-recovery-preview",
    "production-recovery-confirm",
    "production-recovery-approve",
    "production-recovery-execute",
  ],
  "AC-E2E-022": ["version-chains"],
  "AC-E2E-023": ["browser-pass"],
};

const STEP_CHECKS = {
  ...BASE_HISTORY_STEP_CHECKS,
  ...ACTION_HISTORY_STEP_CHECKS,
  ...SUMMARY_HISTORY_STEP_CHECKS,
};

export function historyStepChecks(name, result) {
  const checks = STEP_CHECKS[name]?.(result);
  return checks || [predicate("registeredStep", false, name)];
}
