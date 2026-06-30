/** 项目向导资源步骤类型。 */

export interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

export interface RegistryResourceField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  default?: string | number;
}

export interface RegistryResourceType {
  id: string;
  name: string;
  description?: string;
  fields: RegistryResourceField[];
}

export interface StoredResource {
  id: string;
  type: string;
  name: string;
}

export interface ResourceInstance {
  id: string;
  name: string;
  status: string;
  resourceType?: { key: string; name: string };
  project?: { name: string };
}

export interface ResourcePool {
  id: string;
  type: string;
  name: string;
  status: string;
  available: number;
}

export function collectSelections(resources: RegistryResourceType[]): string[] {
  return resources.map((r) => r.id);
}

export function filterDatabaseResourceMap<T>(
  map: Record<string, T>,
  ids: string[],
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const id of ids) {
    if (id in map) result[id] = map[id];
  }
  return result;
}
