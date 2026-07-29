/**
 * 服务器连接能力判定的纯函数文案/状态助手（F383 结构约束拆分）。
 * 单一职责：把「不存在」「执行器开关」「认证错误清洗」等与具体连接判定无关的
 * 消息组装抽离，避免 capability service 夹杂静态字符串与开关读取。
 */
import { ConfigService } from "@nestjs/config";
import type { ServerConnectionCapability } from "./server-connection-capability.service";

/** 服务器不存在时的能力判定（所有维度 false）。 */
export function capabilityNotFound(): ServerConnectionCapability {
  return {
    authType: null,
    networkReachable: false,
    authenticationVerified: false,
    executorCompatible: false,
    latency: 0,
    message: "服务器不存在",
    recommendation: "确认服务器 ID 与所属团队。",
  };
}

/** 根据 live executor 开关给出可操作的 recommendation（启用时无建议）。 */
export function executorEnabledRecommendation(
  liveEnabled: boolean | string,
): string | undefined {
  if (liveEnabled === true || liveEnabled === "true") return undefined;
  return "在 API 环境变量中设置 SERVER_EXECUTOR_LIVE_ENABLED=true 以启用实时发布执行器。";
}

/** 读取 live executor 开关（容忍 boolean 与 "true" 字符串两种 env schema 形态）。 */
export function readLiveExecutorEnabled(config: ConfigService): boolean {
  const v = config.get("SERVER_EXECUTOR_LIVE_ENABLED", "false");
  return v === true || v === "true";
}

/** 防御性清洗 SSH 错误信息：截断可能被拼入的 PEM 私钥片段。 */
export function sanitizeAuthMessage(msg: string): string {
  return msg.replace(/-{5,}BEGIN[A\s\S]*?END[A-Z ]*-{5,}/g, "[私钥已隐藏]");
}
