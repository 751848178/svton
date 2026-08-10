import { buildLogSummary } from "./release-build-log.utils";

export function canceledBuildLogSummary() {
  return buildLogSummary([
    "result canceled: BUILD_COMMAND_CANCELED 构建已取消",
  ]);
}
