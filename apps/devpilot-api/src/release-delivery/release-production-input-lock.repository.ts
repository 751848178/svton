import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ReleaseDeploymentInputSnapshot } from "./release-deployment-input.types";

type Scope = { teamId: string; projectId: string };

export async function resolveAndLockProductionEnvironment(
  tx: Prisma.TransactionClient,
  scope: Scope,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM ProjectEnvironment
    WHERE teamId = ${scope.teamId} AND projectId = ${scope.projectId}
      AND baselineRole = 'production' AND status = 'active'
    ORDER BY id FOR UPDATE
  `);
  if (rows.length === 0) throw new NotFoundException("生产环境不存在或已停用");
  if (rows.length !== 1) throw new ConflictException("Production 基线环境不唯一");
  return rows[0].id;
}

export async function lockProductionDeploymentInputs(
  tx: Prisma.TransactionClient,
  scope: Scope & { environmentId: string },
  snapshot: ReleaseDeploymentInputSnapshot,
) {
  await requireOne(tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM EnvironmentConfigRevision
    WHERE id = ${snapshot.configRevision.id}
      AND teamId = ${scope.teamId} AND projectId = ${scope.projectId}
      AND environmentId = ${scope.environmentId} FOR UPDATE
  `));
  await requireOne(tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM ProjectEnvironmentServer
    WHERE id = ${snapshot.target.bindingId}
      AND teamId = ${scope.teamId} AND projectId = ${scope.projectId}
      AND environmentId = ${scope.environmentId} AND status = 'active' FOR UPDATE
  `));
  await requireOne(tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM Server WHERE id = ${snapshot.target.serverId}
      AND teamId = ${scope.teamId} FOR UPDATE
  `));
  await lockSecrets(tx, scope, snapshot.secretReferences.map((item) => item.id));
  await lockResources(tx, scope, snapshot.resourceReferences);
}

async function lockSecrets(
  tx: Prisma.TransactionClient,
  scope: Scope,
  values: string[],
) {
  const ids = unique(values);
  if (!ids.length) return;
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM SecretKey WHERE id IN (${Prisma.join(ids)})
      AND teamId = ${scope.teamId}
      AND (projectId IS NULL OR projectId = ${scope.projectId})
    ORDER BY id FOR UPDATE
  `);
  if (rows.length !== ids.length) drift();
}

async function lockResources(
  tx: Prisma.TransactionClient,
  scope: Scope,
  references: ReleaseDeploymentInputSnapshot["resourceReferences"],
) {
  const groups = new Map<string, string[]>();
  for (const item of references) {
    groups.set(item.kind, [...(groups.get(item.kind) ?? []), item.id]);
  }
  await lockResourceGroup(tx, scope, "ManagedResource", groups.get("managed_resource"));
  await lockResourceGroup(tx, scope, "ResourceInstance", groups.get("resource_instance"));
  await lockResourceGroup(tx, scope, "Site", groups.get("site"));
  await lockResourceGroup(tx, scope, "CDNConfig", groups.get("cdn_config"));
}

async function lockResourceGroup(
  tx: Prisma.TransactionClient,
  scope: Scope,
  table: "ManagedResource" | "ResourceInstance" | "Site" | "CDNConfig",
  values: string[] | undefined,
) {
  const ids = unique(values ?? []);
  if (!ids.length) return;
  const tableSql = Prisma.raw(`\`${table}\``);
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM ${tableSql} WHERE id IN (${Prisma.join(ids)})
      AND teamId = ${scope.teamId}
      AND (projectId IS NULL OR projectId = ${scope.projectId})
    ORDER BY id FOR UPDATE
  `);
  if (rows.length !== ids.length) drift();
}

async function requireOne(promise: Promise<Array<{ id: string }>>) {
  if ((await promise).length !== 1) drift();
}
function unique(values: string[]) { return [...new Set(values)].sort(); }
function drift(): never {
  throw new ConflictException("Production 部署输入已漂移，请刷新前置检查");
}
