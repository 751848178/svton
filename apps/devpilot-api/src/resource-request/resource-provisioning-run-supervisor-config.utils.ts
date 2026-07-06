import { ConfigService } from '@nestjs/config';

export function readProvisioningListLimit(
  value: unknown,
  fallback: number,
  max: number,
) {
  const parsed = readProvisioningPositiveInteger(value);
  if (!parsed) return fallback;
  return Math.min(parsed, max);
}

export function readStaleProvisioningRunAfterSeconds(
  configService: ConfigService,
  value?: unknown,
) {
  const configured =
    readProvisioningPositiveInteger(
      configService.get(
        'RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS',
        '1800',
      ),
    ) || 1800;
  return Math.max(readProvisioningPositiveInteger(value) || configured, 60);
}

export function readProvisioningSchedulerConfig(configService: ConfigService) {
  return {
    autoRetryEnabled:
      configService.get(
        'RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_ENABLED',
        'false',
      ) === 'true',
    staleRecoveryEnabled:
      configService.get(
        'RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_ENABLED',
        'false',
      ) === 'true',
    intervalSeconds:
      readProvisioningPositiveInteger(
        configService.get(
          'RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_INTERVAL_SECONDS',
          '60',
        ),
      ) || 60,
    queueingEnabled: readProvisioningBoolean(
      configService.get(
        'RESOURCE_REQUEST_PROVISIONING_HTTP_QUEUE_ENABLED',
        false,
      ),
      false,
    ),
    queueWorkerEnabled:
      configService.get(
        'RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_ENABLED',
        'false',
      ) === 'true',
    providerStatePollingEnabled:
      configService.get(
        'RESOURCE_REQUEST_PROVISIONING_PROVIDER_STATE_POLLING_ENABLED',
        'false',
      ) === 'true',
  };
}

function readProvisioningPositiveInteger(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : Number.parseInt(readProvisioningString(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readProvisioningBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

function readProvisioningString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}
