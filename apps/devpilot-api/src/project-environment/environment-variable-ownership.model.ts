export type EnvironmentVariableSource = "resource" | "plain" | "secret";

export type EnvironmentVariableOwner = {
  key: string;
  source: EnvironmentVariableSource;
  reference: string;
  scope?: string;
};

export type EnvironmentVariableCollision = {
  key: string;
  owners: EnvironmentVariableOwner[];
};

export function findEnvironmentVariableCollisions(
  owners: EnvironmentVariableOwner[],
): EnvironmentVariableCollision[] {
  return [...new Set(owners.map((owner) => owner.key))]
    .map((key) => ({ key, owners: conflictingOwners(owners, key) }))
    .filter((collision) => collision.owners.length > 1)
    .sort((left, right) => left.key.localeCompare(right.key));
}

function conflictingOwners(owners: EnvironmentVariableOwner[], key: string) {
  const matches = owners.filter((owner) => owner.key === key);
  const scopes = new Set(matches.map((owner) => owner.scope ?? "global"));
  if (matches.length < 2 || (scopes.size > 1 && !scopes.has("global"))) return [];
  return matches.sort((left, right) =>
    `${left.scope}:${left.source}:${left.reference}`.localeCompare(
      `${right.scope}:${right.source}:${right.reference}`,
    ));
}

export function environmentVariableCollisionMessage(
  collision: EnvironmentVariableCollision,
) {
  const sources = collision.owners
    .map((owner) => `${owner.source}:${owner.reference}`)
    .join(", ");
  return `环境变量 ${collision.key} 存在来源冲突（${sources}）`;
}
