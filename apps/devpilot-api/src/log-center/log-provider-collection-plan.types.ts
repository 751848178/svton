import { Prisma } from "@prisma/client";

export type LogProviderCollectionPlanStream = {
  id: string;
  teamId: string;
  sourceType: string;
  sourceKey?: string | null;
  managedResourceId?: string | null;
  metadata?: unknown;
  managedResource?: {
    provider?: string | null;
    name?: string | null;
    credentialId?: string | null;
    config?: unknown;
    metadata?: unknown;
  } | null;
};

export type LogProviderCollectionPlanOptions = {
  dryRun: boolean;
  tail: number;
  params?: Record<string, unknown>;
};

export type LogCollectionExecutionResult = {
  status: "queued" | "completed" | "failed" | "blocked" | "cancelled";
  executorKey: string;
  adapterKey: string;
  serverExecutionJobId?: string;
  commandPlan?: Prisma.InputJsonValue;
  logs?: Prisma.InputJsonValue;
  result?: Prisma.InputJsonValue;
  error?: string;
};

export type SlsCollectionPlanContext = {
  params: Record<string, unknown>;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  project: string;
  logstore: string;
  query: string;
  region: string;
  from: Date;
  to: Date;
  windowMinutes: number;
  limit: number;
  liveEnabled: boolean;
  liveConfirmed: boolean;
  adapterKey: string;
  credentialReady: boolean;
  warnings: string[];
  executable: boolean;
  status: "completed" | "blocked";
  error?: string;
};
