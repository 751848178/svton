export type JsonRecord = Record<string, unknown>;

export interface ProvisioningRunStatusCounts {
  queued: number;
  running: number;
  staleRunning: number;
  planned: number;
  blocked: number;
  failed: number;
  completed: number;
}

export type ProvisioningRunRecord = JsonRecord & { id: string };
