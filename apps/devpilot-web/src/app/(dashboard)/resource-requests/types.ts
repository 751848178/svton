/** 资源申请域类型 - 请求/资源类型/供给运行/Supervisor 接口。 */

export type ResourceFieldType = 'text' | 'number' | 'password' | 'textarea' | 'select' | 'checkbox';
export type ResourceFieldValue = string | boolean;

export interface ResourceFieldOption {
  label: string;
  value: string;
}

export interface ResourceField {
  key: string;
  label: string;
  type: ResourceFieldType;
  required?: boolean;
  default?: string | number | boolean;
  placeholder?: string;
  options?: ResourceFieldOption[];
  sensitive?: boolean;
}

export interface ResourceRequestSchema {
  fields?: ResourceField[];
}

export interface ResourceType {
  id: string;
  key: string;
  name: string;
  category?: string;
  requestSchema?: ResourceRequestSchema;
  deliverySchema?: ResourceRequestSchema;
  envTemplate?: string;
  provisioningMode?: string;
}

export interface ProvisioningResult {
  mode?: string;
  status?: string;
  reason?: string;
  boundary?: string;
  provisioningRunId?: string;
  replayOfRunId?: string;
  providerRunId?: string;
  attempt?: number;
  maxAttempts?: number;
}

export interface Project {
  id: string;
  name: string;
}

export interface ResourceRequest {
  id: string;
  title: string;
  environment?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'canceled';
  createdAt: string;
  resourceType?: ResourceType;
  project?: Project;
  requester?: { id: string; name: string | null; email: string };
  instance?: { id: string; name: string; status: string };
  result?: { provisioning?: ProvisioningResult };
}

export interface ResourceProvisioningRun {
  id: string;
  mode?: string;
  trigger?: string;
  boundary?: string;
  executorKey?: string;
  adapterKey?: string;
  authAdapterKey?: string;
  replayOfRunId?: string;
  replayOf?: {
    id: string;
    status?: string;
    trigger?: string;
    providerRunId?: string;
    startedAt?: string;
  };
  replayAttemptsCount?: number;
  idempotencyKey?: string;
  providerRunId?: string;
  status?: string;
  queueMode?: string;
  attempt?: number;
  maxAttempts?: number;
  retryable?: boolean;
  autoRetry?: boolean;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  queuedAt?: string;
  availableAt?: string;
  lockedAt?: string;
  lockOwner?: string;
  finishedAt?: string;
  recoveredAt?: string;
  recoveryReason?: string;
  recoveryCount?: number;
  actor?: { id: string; name: string | null; email: string };
  resourceType?: { id: string; key: string; name: string };
}

export interface ResourceProvisioningRunSupervisor {
  generatedAt: string;
  staleAfterSeconds: number;
  staleBefore: string;
  scheduler: {
    autoRetryEnabled: boolean;
    staleRecoveryEnabled: boolean;
    queueingEnabled?: boolean;
    intervalSeconds: number;
  };
  counts: {
    queued: number;
    running: number;
    staleRunning: number;
    planned: number;
    blocked: number;
    failed: number;
    completed: number;
  };
  samples: {
    queued: ResourceProvisioningRun[];
    staleRunning: ResourceProvisioningRun[];
    recentProblems: ResourceProvisioningRun[];
  };
}
