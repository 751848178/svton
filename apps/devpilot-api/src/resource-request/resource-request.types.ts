/**
 * Shared types for the resource-request feature.
 *
 * Extracted verbatim from `resource-request.service.ts` so the facade and the
 * focused split services (lifecycle / provisioning / recovery / repository /
 * utils) share one stable contract surface. Pure types only — no runtime
 * logic lives here.
 */

export type JsonRecord = Record<string, unknown>;

export type ProvisioningMode =
  | 'manual'
  | 'pool'
  | 'webhook'
  | 'api'
  | 'script'
  | 'credential_only'
  | 'provider';

export type ExternalProvisioningRunMode = Extract<
  ProvisioningMode,
  'webhook' | 'api' | 'provider'
>;

export type ProvisioningProcessorTrigger =
  | 'approval'
  | 'manual_retry'
  | 'auto_retry';

export interface ProvisioningCredentialRef {
  source: 'team_credential';
  credentialType: string;
  referenceId: string;
  displayName: string;
  authAdapterKey: string;
  redacted: true;
}

export interface ProvisioningProcessorContext {
  trigger: ProvisioningProcessorTrigger;
  replayOfRunId?: string;
  replaySourceStatus?: string;
  provisioningRunId?: string;
  forceInline?: boolean;
}

export interface ProvisioningAutoRetryConfig {
  enabled: boolean;
  delaySeconds: number;
  maxScheduledAttempts: number;
}

export interface ProvisioningQueueConfig {
  enabled: boolean;
  delaySeconds: number;
}

export type ResourceProvisioningRunRecord = JsonRecord & { id: string };

export interface ProvisioningAutoRetrySummary {
  scanned: number;
  attempted: number;
  completed: number;
  blocked: number;
  skipped: number;
  failed: number;
}

export interface ProviderStatePollingConfig {
  enabled: boolean;
  intervalSeconds: number;
  maxAttempts: number;
  source: string;
  createInstance?: boolean;
  instanceName?: string;
}

export interface ProviderStatePollingSummary {
  scanned: number;
  polled: number;
  completed: number;
  planned: number;
  blocked: number;
  skipped: number;
  failed: number;
}

export interface ProvisioningStaleRecoverySummary {
  scanned: number;
  recovered: number;
  requestUpdated: number;
  skipped: number;
  failed: number;
}

export interface ProvisioningRunStatusCounts {
  queued: number;
  running: number;
  staleRunning: number;
  planned: number;
  blocked: number;
  failed: number;
  completed: number;
}

export interface ProvisioningQueueProcessSummary {
  scanned: number;
  processed: number;
  skipped: number;
  failed: number;
  reason?: string;
  run?: JsonRecord;
  request?: JsonRecord;
}

export interface ProvisioningResourceType {
  id: string;
  key: string;
  name: string;
  provisioningMode: string;
  provisioningConfig?: unknown;
  deliverySchema?: unknown;
}

export interface CompleteProvisionedRequestInput {
  createInstance: boolean;
  instanceName: string;
  config: JsonRecord;
  delivery: JsonRecord;
  credentials: JsonRecord;
  expiresAt?: Date;
  provisioning: JsonRecord;
  auditMetadata?: JsonRecord;
}

export interface AuditInput {
  teamId: string;
  actorId?: string;
  resourceTypeId?: string;
  requestId?: string;
  instanceId?: string;
  provisioningRunId?: string;
  action: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export type HttpProvisioningResponse = {
  ok: boolean;
  status: number;
  statusText?: string;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export type HttpProvisioningFetch = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<HttpProvisioningResponse>;
