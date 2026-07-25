/**
 * 告警通知深链构建器(N5:告警通知直达日志/部署详情)。
 *
 * 单一职责:根据告警 metric 与 evaluation value,渲染一条可点击的绝对 URL。
 * - 日志类告警(log_*_count)→ `/logs?streamId=&from=&to`
 * - 部署告警(deployment_status / deployment_smoke_check_failure)→ `/logs?deploymentRunId=`
 * - 其他 metric 或缺少必要字段 → 返回 null(保持现有通知格式,零回归)。
 *
 * 纯函数,无副作用,便于单测。
 */

const LOG_PATH = "/logs";
const DEPLOYMENT_PATH = "/logs";

export function buildAlertDeepLink(
  webBaseUrl: string | null | undefined,
  event: { metric: string; value?: unknown },
): string | null {
  const normalizedBase = normalizeWebBaseUrl(webBaseUrl);
  if (!normalizedBase) return null;

  const value = asRecord(event.value);
  if (!value) return null;

  if (event.metric.startsWith("log_") && event.metric.endsWith("_count")) {
    const streamId = readString(value.streamId);
    const from = readString(value.from);
    const to = readString(value.to);
    // 日志深链需要 streamId(否则无对应日志流);from/to 为窗口范围,可选但推荐。
    if (!streamId) return null;
    const params = new URLSearchParams();
    params.set("streamId", streamId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `${normalizedBase}${LOG_PATH}?${params.toString()}`;
  }

  if (event.metric === "deployment_status") {
    const deploymentRunId = readString(value.deploymentRunId);
    if (!deploymentRunId) return null;
    return buildDeploymentRunDeepLink(normalizedBase, deploymentRunId);
  }

  if (event.metric === "deployment_smoke_check_failure") {
    // smoke check 的 value.latestRuns[0].id 是最近一次部署运行 id。
    const latestRuns = Array.isArray(value.latestRuns) ? value.latestRuns : [];
    const firstRun = asRecord(latestRuns[0]);
    const deploymentRunId = firstRun ? readString(firstRun.id) : null;
    if (!deploymentRunId) return null;
    return buildDeploymentRunDeepLink(normalizedBase, deploymentRunId);
  }

  return null;
}

function buildDeploymentRunDeepLink(base: string, deploymentRunId: string) {
  const params = new URLSearchParams();
  params.set("deploymentRunId", deploymentRunId);
  return `${base}${DEPLOYMENT_PATH}?${params.toString()}`;
}

function normalizeWebBaseUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    // 校验为合法 http(s) URL,丢弃非法值(零回归)。
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }
  // 去掉尾部斜杠,避免拼接出 `//logs`。
  return trimmed.replace(/\/+$/, "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  // Date / number 会被 JSON 序列化为字符串;这里只接受原始字符串,
  // 评估服务写入 value 时 from/to 是 Date,经 Prisma Json 列读出已为 ISO 字符串。
  return null;
}
