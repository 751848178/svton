export type EnvironmentVariableSource = "resource" | "plain" | "secret";

export type EnvironmentVariableOwner = {
  key: string;
  source: EnvironmentVariableSource;
  reference: string;
};

export type EnvironmentVariableCollision = {
  key: string;
  owners: EnvironmentVariableOwner[];
};

export function findEnvironmentVariableCollisions(
  owners: EnvironmentVariableOwner[],
): EnvironmentVariableCollision[] {
  const byKey = new Map<string, EnvironmentVariableOwner[]>();
  for (const owner of owners) {
    const entries = byKey.get(owner.key) ?? [];
    entries.push(owner);
    byKey.set(owner.key, entries);
  }
  return [...byKey.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([key, entries]) => ({
      key,
      owners: entries.sort((left, right) =>
        `${left.source}:${left.reference}`.localeCompare(`${right.source}:${right.reference}`)),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function environmentVariableCollisionMessage(
  collision: EnvironmentVariableCollision,
) {
  const sources = collision.owners
    .map((owner) => `${owner.source}:${owner.reference}`)
    .join(", ");
  return `环境变量 ${collision.key} 存在来源冲突（${sources}）`;
}
