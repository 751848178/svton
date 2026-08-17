import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ResourceReferenceInput,
  SafeResourceReference,
} from "./environment-config-revision.types";
import {
  environmentKeysFromTemplate,
  resourceVariableOwners,
} from "./environment-variable-binding.utils";
import type { EnvironmentVariableOwner } from "./environment-variable-ownership.model";
import { resourceReferenceStateful } from "./resource-statefulness.policy";

type ResourceScope = {
  id: string;
  teamId: string;
  projectId: string;
  baselineRole?: string | null;
};

export async function resolveEnvironmentConfigResources(
  tx: Prisma.TransactionClient,
  scope: ResourceScope,
  inputs: ResourceReferenceInput[],
): Promise<{ references: SafeResourceReference[]; owners: EnvironmentVariableOwner[] }> {
  const allEnvironmentIds = [...new Set(inputs.flatMap((item) => item.sharedEnvironmentIds))];
  const environments = await tx.projectEnvironment.findMany({
    where: { id: { in: allEnvironmentIds }, teamId: scope.teamId, projectId: scope.projectId },
    select: { id: true },
  });
  if (environments.length !== allEnvironmentIds.length) {
    throw new BadRequestException("共享环境 引用无效或越权");
  }
  const output: SafeResourceReference[] = [];
  const owners: EnvironmentVariableOwner[] = [];
  for (const input of inputs) {
    validateSharing(scope, input);
    const row = await findResource(tx, scope, input);
    if (!row) throw new BadRequestException(`资源引用 ${input.kind}:${input.id} 无效或跨项目`);
    if (row.environmentId && !input.sharedEnvironmentIds.includes(row.environmentId)) {
      throw new BadRequestException(`资源 ${input.id} 的所属环境未包含在共享范围`);
    }
    const sourceKeys = environmentKeysFromTemplate(row.envTemplate);
    validateBindings(input, sourceKeys);
    owners.push(...resourceVariableOwners(input, sourceKeys));
    output.push({
      ...input,
      name: row.name,
      stateful: resourceReferenceStateful({
        kind: input.kind,
        resourceKind: row.resourceTypeKey,
        category: row.resourceTypeCategory,
      }),
      ...(row.resourceTypeKey ? { resourceTypeKey: row.resourceTypeKey } : {}),
      ...(row.resourceTypeCategory !== undefined
        ? { resourceTypeCategory: row.resourceTypeCategory }
        : {}),
    });
  }
  return {
    references: output.sort((left, right) =>
      `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`)),
    owners,
  };
}

function validateSharing(scope: ResourceScope, input: ResourceReferenceInput) {
  if (!input.sharedEnvironmentIds.includes(scope.id)) {
    throw new BadRequestException(`资源 ${input.id} 的共享环境必须包含当前环境`);
  }
  if (scope.baselineRole === "production" && input.sharedEnvironmentIds.length > 1) {
    throw new BadRequestException(
      `Production 环境禁止与非生产环境共享资源 ${input.id}，必须保持环境专用`,
    );
  }
  if (input.sharedEnvironmentIds.length > 1 && input.risk === "low") {
    throw new BadRequestException(`共享资源 ${input.id} 的风险不能为 low`);
  }
}

function validateBindings(input: ResourceReferenceInput, sourceKeys: string[]) {
  if (input.componentKey && sourceKeys.length > 0 && input.envBindings === undefined) {
    throw new BadRequestException(`资源 ${input.id} 必须显式确认环境变量映射`);
  }
  const unknown = input.envBindings?.find((binding) => !sourceKeys.includes(binding.sourceKey));
  if (unknown) {
    throw new BadRequestException(`资源 ${input.id} 的来源变量 ${unknown.sourceKey} 不属于资源模板`);
  }
}

async function findResource(
  tx: Prisma.TransactionClient,
  scope: ResourceScope,
  input: ResourceReferenceInput,
) {
  const args = {
    where: { id: input.id, teamId: scope.teamId, projectId: scope.projectId },
    select: { id: true, name: true, environmentId: true },
  };
  if (input.kind === "resource_instance") {
    const row = await tx.resourceInstance.findFirst({
      where: args.where,
      select: { ...args.select, resourceType: {
        select: { envTemplate: true, key: true, category: true },
      } },
    });
    return row ? {
      ...row,
      envTemplate: row.resourceType.envTemplate,
      resourceTypeKey: row.resourceType.key,
      resourceTypeCategory: row.resourceType.category,
    } : null;
  }
  if (input.kind === "managed_resource") {
    const managed = await tx.managedResource.findFirst({
      where: args.where,
      select: {
        ...args.select,
        kind: true,
        resourceInstance: { select: { resourceType: {
          select: { key: true, category: true },
        } } },
      },
    });
    return managed ? {
      ...managed,
      envTemplate: null,
      resourceTypeKey: managed.resourceInstance?.resourceType.key ?? managed.kind,
      resourceTypeCategory:
        managed.resourceInstance?.resourceType.category ?? managed.kind,
    } : null;
  }
  const row = input.kind === "site"
    ? await tx.site.findFirst(args)
    : await tx.cDNConfig.findFirst(args);
  if (!row) return null;
  return { ...row, envTemplate: null,
    resourceTypeKey: null, resourceTypeCategory: null };
}
