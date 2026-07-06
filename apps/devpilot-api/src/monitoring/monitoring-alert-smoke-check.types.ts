export type SiteSmokeCheckRunRecord = {
  id: string;
  status: string;
  dryRun: boolean;
  trigger: string;
  targetConfigPath: string | null;
  serverExecutionJobId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
  result: unknown;
  warnings: unknown;
};

export type DeploymentSmokeCheckRunRecord = {
  id: string;
  status: string;
  dryRun: boolean;
  source: string;
  trigger: string;
  sourceRunId: string | null;
  serverExecutionJobId: string | null;
  healthCheckUrl: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
  result: unknown;
};
