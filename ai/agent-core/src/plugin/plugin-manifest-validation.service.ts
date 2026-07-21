import type { PluginManifest } from './types';

export function validatePluginManifest(manifest: PluginManifest): void {
  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error('Plugin manifest must have a "name" field');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new Error('Plugin manifest must have a "version" field');
  }
}
