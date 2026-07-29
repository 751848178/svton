/**
 * 服务器响应格式化纯函数（F383 结构约束拆分）。
 * 单一职责：剥离 `credentials` 明文字段，补齐 tags/services 默认形状，
 * 供 create/findAll/findOne/update 的返回值统一脱敏 + 归一化。
 */

/** 服务器持久层行（Prisma 返回形状的宽松描述）。 */
type ServerRow = {
  credentials?: unknown;
  tags?: unknown;
  services?: unknown;
} & Record<string, unknown>;

/**
 * 返回去掉 `credentials` 的响应副本，并补齐 `tags`/`services` 默认值。
 * 任何时刻都不应把 `credentials`（加密或明文）泄露给 API 响应。
 * 泛型 T 透传调用方的行类型（如 Prisma include 形状），避免把 `id`/`environmentBindings`
 * 等字段丢失成 `unknown`，保持 controller 的 ReadableServerRecord 约束可满足。
 */
export function formatServerResponse<T extends ServerRow>(server: T): Omit<T, "credentials"> {
  const { credentials: _dropped, ...rest } = server;
  void _dropped;
  return {
    ...rest,
    tags: (server.tags ?? []) as T["tags"],
    services: (server.services ?? {}) as T["services"],
  };
}
