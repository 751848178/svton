import { ConfigService } from "@nestjs/config";
import { ProviderRequestPolicy } from "../common/retry/provider-retry";
import { AliyunSlsCredentialConfig } from "./aliyun-sls-log-query.types";

export function createAliyunSlsProviderRequestPolicy(
  configService: ConfigService,
  config: AliyunSlsCredentialConfig,
): ProviderRequestPolicy {
  return {
    timeoutMs: asPositiveInt(
      config.slsQueryTimeoutMs ??
        configService.get("LOG_CENTER_SLS_QUERY_TIMEOUT_MS", "10000"),
      10000,
      120000,
    ),
    retryAttempts: asNonNegativeInt(
      config.slsQueryRetryAttempts ??
        configService.get("LOG_CENTER_SLS_QUERY_RETRY_ATTEMPTS", "1"),
      1,
      5,
    ),
    retryBaseDelayMs: asPositiveInt(
      config.slsQueryRetryBaseDelayMs ??
        configService.get("LOG_CENTER_SLS_QUERY_RETRY_BASE_DELAY_MS", "200"),
      200,
      10000,
    ),
    attempts: 0,
    retries: 0,
  };
}

export function summarizeAliyunSlsRequestPolicy(policy: ProviderRequestPolicy) {
  return {
    timeoutMs: policy.timeoutMs,
    retryAttempts: policy.retryAttempts,
    retryBaseDelayMs: policy.retryBaseDelayMs,
    attempts: policy.attempts,
    retries: policy.retries,
  };
}

function asPositiveInt(value: unknown, fallback: number, max?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  const intValue = Math.floor(parsed);
  return max ? Math.min(intValue, max) : intValue;
}

function asNonNegativeInt(value: unknown, fallback: number, max?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  const intValue = Math.floor(parsed);
  return max ? Math.min(intValue, max) : intValue;
}
