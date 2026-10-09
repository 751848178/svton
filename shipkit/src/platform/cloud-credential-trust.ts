import { createHash } from 'node:crypto';
import type { ShipConfig } from '../shared/types.js';

const keys = ['TENCENTCLOUD_SECRET_ID', 'TENCENTCLOUD_SECRET_KEY'] as const;

/** Private trust markers only: SDKs still read env, and rotation invalidates saved tasks. */
export function cloudCredentialDigests(config: ShipConfig): Record<string, string> | undefined {
  if (config.builder.mode !== 'dynamic') return undefined;
  return Object.fromEntries(keys.map(key => [key, createHash('sha256').update(JSON.stringify(process.env[key] ?? null)).digest('hex')]));
}
export function cloudCredentialValues(config: ShipConfig): string[] {
  return config.builder.mode === 'dynamic' ? keys.map(key => process.env[key]).filter((value): value is string => Boolean(value && value.length >= 3)) : [];
}
export function assertCloudCredentialTrust(config: ShipConfig, expected?: Record<string, string>): void {
  const actual = cloudCredentialDigests(config);
  if (!actual) return;
  if (!expected || keys.some(key => expected[key] !== actual[key])) {
    throw new Error('Saved cloud credential reference changed or is not pinned; restore the original credentials or create a fresh plan before observing, executing or cleaning up this task');
  }
}
