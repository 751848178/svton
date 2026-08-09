export const C5_WORKSPACE_BUILD_SELECTORS = Object.freeze([
  "@svton/devpilot-api...",
  "@svton/devpilot-web...",
]);
export const C5_WORKSPACE_BUILD_TIMEOUT_MS = 12 * 60_000;

export function buildC5WorkspaceClosures(run, environment) {
  const buildEnvironment = {
    ...environment,
    CI: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  for (const selector of C5_WORKSPACE_BUILD_SELECTORS) {
    run(
      "corepack",
      ["pnpm", "--filter", selector, "build"],
      buildEnvironment,
      { timeoutMs: C5_WORKSPACE_BUILD_TIMEOUT_MS },
    );
  }
}
