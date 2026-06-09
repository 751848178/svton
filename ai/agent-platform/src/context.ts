import type { IPlatform } from './types';

let currentPlatform: IPlatform | null = null;

/**
 * Set the platform instance at application startup.
 * Must be called before any agent-core module is used.
 */
export function setPlatform(platform: IPlatform): void {
  currentPlatform = platform;
}

/**
 * Get the current platform instance.
 * Throws if setPlatform() has not been called.
 */
export function getPlatform(): IPlatform {
  if (!currentPlatform) {
    throw new Error(
      'Platform not initialized. Call setPlatform() before using agent modules.',
    );
  }
  return currentPlatform;
}

/**
 * Check if a platform has been set.
 */
export function hasPlatform(): boolean {
  return currentPlatform !== null;
}
