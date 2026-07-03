export type MonitoringAuthRequest = {
  user: { id: string };
  teamId: string;
};

export type ReadableMonitoringRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
  rule?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
  channel?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
  alertEvent?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
};
