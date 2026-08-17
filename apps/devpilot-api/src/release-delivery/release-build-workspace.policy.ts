import { realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";

export async function assertReleaseBuildCheckoutRoot(
  parent: string,
  requested: string,
) {
  const root = await realpath(parent);
  const child = relative(root, requested);
  if (child === "" || child.startsWith("..") || child.startsWith("/")) {
    throw workspaceFailure(
      "BUILD_WORKSPACE_OUTSIDE_ROOT",
      "构建检出目录不属于受控工作卷",
      "请检查验收 runtime profile 的工作目录配置。",
    );
  }
}

export async function confinedReleaseBuildDirectory(
  root: string,
  requested: string,
) {
  const candidate = await realpath(resolve(root, requested));
  const child = relative(root, candidate);
  if (child.startsWith("..") || child.startsWith("/")) {
    throw workspaceFailure(
      "BUILD_WORKDIR_OUTSIDE_CHECKOUT",
      "构建工作目录越过隔离检出边界",
      "请将工作目录改为仓库内的相对路径。",
    );
  }
  return candidate;
}

function workspaceFailure(code: string, message: string, action: string) {
  return new ReleaseBuildExecutionError({
    code,
    message,
    logs: [`result failed: ${code} ${message}`],
    gateSummary: { build: { status: "failed" }, action },
    status: "failed",
  });
}
