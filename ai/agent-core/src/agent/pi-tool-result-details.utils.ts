export interface SvtonToolResultDetails {
  callId: string;
  toolName: string;
  isError: boolean;
  metadata?: Record<string, unknown>;
}

export function readSvtonToolResultError(details: unknown): boolean | undefined {
  if (!isRecord(details) || typeof details.isError !== 'boolean') {
    return undefined;
  }
  return details.isError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
