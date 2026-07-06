export type AlertEvaluationResult = {
  status: 'ok' | 'firing' | 'insufficient_data' | 'error';
  eventStatus: 'resolved' | 'firing' | 'insufficient_data' | 'error';
  summary: string;
  value: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
