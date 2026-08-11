import type {
  EnvironmentVariableBinding,
  ResourceReferenceInput,
  SafeSecretReference,
} from "./environment-config-revision.types";
import type { EnvironmentVariableOwner } from "./environment-variable-ownership.model";

export function environmentKeysFromTemplate(template: string | null | undefined) {
  if (!template) return [];
  const keys = new Set<string>();
  for (const rawLine of template.split(/\r?\n/)) {
    const line = rawLine.trim();
    const equals = line.indexOf("=");
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) keys.add(key);
  }
  return [...keys].sort();
}

export function effectiveResourceBindings(
  reference: Pick<ResourceReferenceInput, "envBindings">,
  sourceKeys: string[],
): EnvironmentVariableBinding[] {
  return reference.envBindings ?? sourceKeys.map((key) => ({ sourceKey: key, targetEnvKey: key }));
}

export function secretTargetEnvKey(secret: Pick<SafeSecretReference, "name" | "targetEnvKey">) {
  return secret.targetEnvKey ?? secret.name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

export function resourceVariableOwners(
  reference: Pick<ResourceReferenceInput, "id" | "kind" | "componentKey" | "envBindings">,
  sourceKeys: string[],
): EnvironmentVariableOwner[] {
  return effectiveResourceBindings(reference, sourceKeys).map((binding) => ({
    key: binding.targetEnvKey,
    source: "resource",
    reference: `${reference.kind}:${reference.id}:${binding.sourceKey}`,
    scope: reference.componentKey ?? "unassigned",
  }));
}

export function mapResourceEnvironment(
  rendered: Record<string, string>,
  bindings: EnvironmentVariableBinding[],
) {
  return Object.fromEntries(bindings.map((binding) => [
    binding.targetEnvKey,
    rendered[binding.sourceKey] ?? "",
  ]));
}
