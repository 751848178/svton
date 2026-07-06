export type CloudSyncProviderDiagnostic = {
  provider: string;
  syncMode?: string;
  fallbackReason?: string;
  live?: boolean;
  errors: string[];
};

export type CloudSyncFailureSample = {
  runId: string;
  provider: string;
  status: string;
  reason: string;
  startedAt: Date;
  fallbackReason?: string;
  errors?: string[];
};

export type CloudSyncRunForEvaluation = {
  id: string;
  provider: string;
  status: string;
  startedAt: Date;
};
