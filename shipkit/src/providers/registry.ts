// Provider selection from controller config. New clouds plug in here.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError } from '../shared/config.js';
import type { ShipConfig } from '../shared/types.js';
import type { BuilderProvider } from './provider.js';
import { StaticBuilderProvider } from './static.js';

/** shipkit repo root (this file compiles to dist/providers/registry.js). */
export function resolveShipkitRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export async function createBuilderProvider(config: ShipConfig): Promise<BuilderProvider> {
  if (config.builder.mode === 'static') {
    if (!config.builder.static) throw new ConfigError('builder.static is required for static mode');
    return new StaticBuilderProvider(config.builder.static);
  }
  const dyn = config.builder.dynamic;
  if (!dyn) throw new ConfigError('builder.dynamic is required for dynamic mode');
  if (dyn.provider === 'tencent') {
    if (!dyn.tencent) throw new ConfigError('builder.dynamic.tencent is required');
    const { TencentBuilderProvider } = await import('./tencent.js');
    const root = resolveShipkitRoot();
    return new TencentBuilderProvider(dyn.tencent, dyn.keepMinutes ?? 30, path.join(root, 'dist'), path.join(root, 'bootstrap'));
  }
  throw new ConfigError(`unknown builder provider '${dyn.provider}' (available: static, tencent)`);
}
