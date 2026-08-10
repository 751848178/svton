import type { EnvironmentConfigResourceReference } from '../../types/environment-config-revision.types';

type PreviewableResource = {
  id: string;
  kind: EnvironmentConfigResourceReference['kind'];
  resourceType?: { envTemplate?: string | null } | null;
};

export type ResourceBindingPreview = {
  componentKey: string | null;
  envBindings: Array<{ sourceKey: string; targetEnvKey: string }>;
  status: 'draft' | 'effective';
};

export function buildResourceBindingPreview(
  instance: PreviewableResource,
  componentKey: string | null,
  currentReferences: EnvironmentConfigResourceReference[],
  envBindings?: EnvironmentConfigResourceReference['envBindings'],
): ResourceBindingPreview {
  const keys = templateKeys(instance.resourceType?.envTemplate);
  const effective = currentReferences.find((reference) =>
    reference.kind === instance.kind && reference.id === instance.id);
  if (effective && envBindings === undefined) {
    return {
      componentKey: effective.componentKey ?? null,
      envBindings: effective.envBindings ?? keys.map((key) => ({
        sourceKey: key,
        targetEnvKey: key,
      })),
      status: 'effective',
    };
  }
  const nextBindings = envBindings ?? keys.map((key) => ({
    sourceKey: key,
    targetEnvKey: key,
  }));
  const unchanged = Boolean(effective) && effective?.componentKey === componentKey &&
    JSON.stringify(effective.envBindings ?? []) === JSON.stringify(nextBindings);
  return {
    componentKey,
    envBindings: nextBindings,
    status: unchanged ? 'effective' : 'draft',
  };
}

export function resourceDraftIssues(
  drafts: EnvironmentConfigResourceReference[],
  current: EnvironmentConfigResourceReference[],
) {
  return drafts.flatMap((draft) => {
    const legacy = current.some((reference) =>
      reference.kind === draft.kind && reference.id === draft.id &&
      reference.componentKey === undefined && reference.envBindings === undefined);
    if (legacy && draft.componentKey === undefined && draft.envBindings === undefined) return [];
    const issues: string[] = [];
    if (!draft.componentKey) issues.push('component');
    if (!Array.isArray(draft.envBindings)) issues.push('mappings');
    if (draft.envBindings?.some((binding) => !binding.targetEnvKey)) issues.push('target');
    return issues.map((issue) => `${draft.kind}:${draft.id}:${issue}`);
  });
}

export function templateKeys(template: string | null | undefined) {
  if (!template) return [];
  const keys = new Set<string>();
  for (const rawLine of template.split(/\r?\n/)) {
    const line = rawLine.trim();
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) keys.add(key);
  }
  return [...keys].sort();
}
