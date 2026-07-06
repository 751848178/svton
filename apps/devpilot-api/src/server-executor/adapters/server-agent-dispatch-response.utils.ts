import { AxiosError } from "axios";
import { ServerExecutionResult } from "../server-executor.types";
import { readOptionalString } from "./server-agent-dispatch-json.utils";

export function readServerAgentDispatcherStatus(
  value: unknown,
): ServerExecutionResult["status"] | undefined {
  if (
    value === "completed" ||
    value === "failed" ||
    value === "blocked" ||
    value === "cancelled"
  ) {
    return value;
  }
  return undefined;
}

export function readServerAgentDispatchError(error: unknown) {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const message =
      readOptionalString(error.message) || "dispatcher request failed";
    return status
      ? `Server agent dispatcher 请求失败(${status}): ${message}`
      : `Server agent dispatcher 请求失败: ${message}`;
  }
  return error instanceof Error
    ? `Server agent dispatcher 请求失败: ${error.message}`
    : "Server agent dispatcher 请求失败";
}
