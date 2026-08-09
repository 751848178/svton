export const C5_WORKSPACE_BUILD_SELECTORS = Object.freeze([
  "@svton/devpilot-api...",
  "@svton/devpilot-web...",
]);
export const C5_WORKSPACE_BUILD_TIMEOUT_MS = 12 * 60_000;

export function buildC5WorkspaceClosures(
  run,
  environment,
  cacheLifecycle = {
    prepare: prepareC5WebBuildCache,
    cleanup: cleanupC5WebBuildCache,
  },
) {
  const buildEnvironment = {
    ...environment,
    CI: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  for (const selector of C5_WORKSPACE_BUILD_SELECTORS) {
    if (selector === "@svton/devpilot-web...") {
      buildWebClosure(run, environment, buildEnvironment, cacheLifecycle);
    } else {
      runBuild(run, selector, buildEnvironment);
    }
  }
}

function buildWebClosure(run, environment, buildEnvironment, cacheLifecycle) {
  const cache = cacheLifecycle.prepare(environment);
  try {
    runBuild(run, "@svton/devpilot-web...", {
      ...buildEnvironment,
      DEVPILOT_NEXT_DIST_DIR: cache.distDir,
    });
  } finally {
    cacheLifecycle.cleanup(cache, environment);
  }
}

function runBuild(run, selector, environment) {
  run("corepack", ["pnpm", "--filter", selector, "build"], environment, {
    timeoutMs: C5_WORKSPACE_BUILD_TIMEOUT_MS,
  });
}
import {
  cleanupC5WebBuildCache,
  prepareC5WebBuildCache,
} from "./parity-isolated-c5-web-build-cache.mjs";
