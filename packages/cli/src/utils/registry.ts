export const DEFAULT_NPM_REGISTRY = 'https://registry.npmmirror.com';

export function normalizeRegistry(value?: string): string | undefined {
  const registry = value?.trim();
  if (!registry) return undefined;
  return registry.replace(/\/+$/, '');
}

export function resolveNpmRegistry(override?: string): string {
  return normalizeRegistry(override) || normalizeRegistry(process.env.SVTON_NPM_REGISTRY) || DEFAULT_NPM_REGISTRY;
}

export function createNpmrc(registry: string): string {
  return [
    `registry=${normalizeRegistry(registry) || DEFAULT_NPM_REGISTRY}`,
    'auto-install-peers=true',
    'strict-peer-dependencies=false',
    '',
  ].join('\n');
}
