export interface JobStats {
  total: number;
  queued: number;
  running: number;
  stale: number;
  blocked: number;
  failed: number;
  cancelled: number;
}

export interface LeaseStats {
  total: number;
  running: number;
  blocked: number;
  expired: number;
  failed: number;
}
