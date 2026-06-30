import type { CredentialProfile } from './types';
/** 资源管控域类型 - 连接/查询/能力接口。 */

export interface ResourceConnectionRun {
  id: string;
  authAdapterKey: string;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  sourceType: string;
  provider: string;
  kind: string;
  status: 'running' | 'completed' | 'failed' | 'blocked';
  targetEndpoint?: string | null;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
}

export interface ResourceQueryRun {
  id: string;
  queryType: string;
  query?: string | null;
  authAdapterKey: string;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  sourceType: string;
  provider: string;
  kind: string;
  status: 'running' | 'completed' | 'failed' | 'blocked';
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  result?: ResourceQueryRunResult | null;
  resource?: {
    id: string;
    name: string;
    provider: string;
    kind: string;
    sourceType: string;
    endpoint?: string | null;
  } | null;
}

export interface ResourceQueryRunResult {
  mode?: string;
  executed?: boolean;
  adapterState?: {
    current?: string;
    executable?: boolean;
    nextExecutorBoundary?: string;
  };
  preview?: QueryResultPreview;
  livePrerequisites?: Array<{
    key: string;
    status: string;
    detail?: string;
  }>;
  warnings?: string[];
}

export interface QueryResultPreview {
  source?: string;
  sample?: boolean;
  shape?: string;
  columns?: Array<{
    key: string;
    label: string;
    type?: string;
    masked?: boolean;
  }>;
  rows?: Array<Record<string, unknown>>;
  pageInfo?: {
    limit?: number;
    returned?: number;
    hasMore?: boolean;
    cursor?: string | null;
    nextCursor?: string | null;
  };
  redaction?: {
    enabled?: boolean;
    maskedColumnKeys?: string[];
  };
  notes?: string[];
}

export interface CapabilityResponse {
  syncMode: string;
  executionMode?: string;
  executorAdapters?: Array<{
    key: string;
    currentTransport: string;
    currentAdapter?: string;
    futureTransport: string;
  }>;
  credentialAuthAdapters?: Array<{
    key: string;
    source: string;
    currentStatus: string;
    futureTransport: string;
  }>;
  credentialProfiles?: CredentialProfile[];
  queryAdapters?: Array<{
    key: string;
    sourceTypes: string[];
    currentStatus: string;
    futureTransport: string;
  }>;
  sourceTypes: Array<{
    key: string;
    name: string;
    description: string;
    adapters: Array<{
      provider: string;
      status: string;
      resourceKinds: string[];
      nextStep?: string;
      credentialType?: string;
    }>;
  }>;
  plannedActions: string[];
  reusableSvtonResources: string[];
  safetyNotes: string[];
}
