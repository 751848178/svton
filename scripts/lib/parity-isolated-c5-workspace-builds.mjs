export const C5_WORKSPACE_BUILD_SELECTORS = Object.freeze([
  "@svton/devpilot-api...",
  "@svton/devpilot-web...",
]);

export function buildC5WorkspaceClosures(run, environment) {
  for (const selector of C5_WORKSPACE_BUILD_SELECTORS) {
    run("corepack", ["pnpm", "--filter", selector, "build"], environment);
  }
}
