export interface TimelineUsageSnapshot {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h?: number;
  reasoning?: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

export interface TimelineUsageContribution {
  responseKey: string;
  usage: TimelineUsageSnapshot;
}

export interface TimelineUsageState {
  usage?: TimelineUsageSnapshot;
  usageResponseKeys?: string[];
}
