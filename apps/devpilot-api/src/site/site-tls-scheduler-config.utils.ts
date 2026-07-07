/**
 * Pure config readers + summary builders for the TLS probe/renew schedulers.
 * Extracted to bring both scheduler services under the 200-line ceiling.
 */

export function tlsProbeSchedulerEnabled(raw: string | undefined): boolean {
  return raw === 'true';
}

export function tlsProbeIntervalMs(raw: string | undefined): number {
  const seconds = Number(raw ?? '3600');
  const safeSeconds = Number.isFinite(seconds) && seconds >= 60 ? seconds : 3600;
  return safeSeconds * 1000;
}

export function tlsRenewSchedulerEnabled(raw: string | undefined): boolean {
  return raw === 'true';
}

export function tlsRenewSchedulerDryRun(raw: string | undefined): boolean {
  return raw !== 'false';
}

export function tlsRenewIntervalMs(raw: string | undefined): number {
  const seconds = Number(raw ?? '86400');
  return Number.isFinite(seconds) && seconds >= 3600 ? seconds * 1000 : 86400 * 1000;
}

export function tlsRenewBeforeMsClamped(raw: string | undefined): number {
  const days = Number(raw ?? '30');
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30;
  return safeDays * 24 * 60 * 60 * 1000;
}

export function tlsRenewMinIntervalMsClamped(raw: string | undefined): number {
  const seconds = Number(raw ?? '86400');
  return Number.isFinite(seconds) && seconds >= 3600 ? seconds * 1000 : 86400 * 1000;
}

export function tlsProbeBatchSize(raw: string | undefined): number {
  const size = Number(raw ?? '20');
  return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
}

export function tlsProbeMaxAttempts(raw: string | undefined): number {
  const attempts = Number(raw ?? '1');
  return Number.isInteger(attempts) && attempts > 0 ? Math.min(attempts, 5) : 1;
}

export function tlsProbeMinIntervalMs(raw: string | undefined): number {
  const seconds = Number(raw ?? '21600');
  const safeSeconds = Number.isFinite(seconds) && seconds >= 300 ? seconds : 21600;
  return safeSeconds * 1000;
}

export function tlsRenewBatchSize(raw: string | undefined): number {
  const size = Number(raw ?? '20');
  return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
}

export function tlsRenewMaxAttempts(raw: string | undefined): number {
  const attempts = Number(raw ?? '1');
  return Number.isInteger(attempts) && attempts > 0 ? Math.min(attempts, 5) : 1;
}
