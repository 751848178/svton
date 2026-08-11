import type { EnvironmentConfigResourceReference } from '../../types/environment-config-revision.types';
import type { EnvironmentConfigSecretReference } from '../../types/environment-config-revision.types';

export type VariableBindingCollision = {
  key: string;
  sources: string[];
};

export function defaultSecretTargetKey(name: string) {
  const normalized = name.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
  return /^[A-Z_]/.test(normalized) ? normalized : `SECRET_${normalized}`;
}

export function upsertSecretReference(
  references: EnvironmentConfigSecretReference[],
  reference: EnvironmentConfigSecretReference,
) {
  const existing = references.findIndex((item) => item.id === reference.id);
  if (existing < 0) return [...references, reference];
  return references.map((item, index) => index === existing ? reference : item);
}

export function findVariableBindingCollisions(
  plainKeys: string[],
  secrets: EnvironmentConfigSecretReference[],
  resources: EnvironmentConfigResourceReference[],
): VariableBindingCollision[] {
  const owners = new Map<string, string[]>();
  const add = (key: string, source: string) => {
    const current = owners.get(key) ?? [];
    owners.set(key, [...current, source]);
  };
  plainKeys.forEach((key) => add(key, `plain:${key}`));
  secrets.forEach((secret) => add(secret.targetEnvKey, `secret:${secret.id}`));
  resources.forEach((resource) => resource.envBindings?.forEach((binding) =>
    add(binding.targetEnvKey, `resource:${resource.kind}:${resource.id}`)));
  return [...owners.entries()]
    .filter(([, sources]) => sources.length > 1)
    .map(([key, sources]) => ({ key, sources: [...sources].sort() }))
    .sort((left, right) => left.key.localeCompare(right.key));
}
