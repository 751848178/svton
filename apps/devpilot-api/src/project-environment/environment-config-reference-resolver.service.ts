import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateEnvironmentConfigRevisionDto } from "./dto/environment-config-revision.dto";
import type {
  EnvironmentConfigSnapshot,
  ResourceReferenceInput,
  SafeResourceReference,
} from "./environment-config-revision.types";
import {
  normalizePlainVariables,
  normalizeResourceReferences,
  normalizeRouteSnapshot,
} from "./environment-config-revision.utils";

type EnvironmentScope = {
  id: string;
  teamId: string;
  projectId: string;
  /** F446 AC-SET-026: production baselines must never share stateful resources. */
  baselineRole?: "staging" | "production" | string | null;
};
type PreviousRevision = {
  plainVariables: unknown;
  secretReferences: unknown;
  resourceReferences: unknown;
  routeSnapshot: unknown;
  policyReferences: unknown;
} | null;

@Injectable()
export class EnvironmentConfigReferenceResolverService {
  async resolve(
    tx: Prisma.TransactionClient,
    environment: EnvironmentScope,
    dto: CreateEnvironmentConfigRevisionDto,
    previous: PreviousRevision,
  ): Promise<EnvironmentConfigSnapshot> {
    const plainVariables = dto.plainVariables === undefined
      ? this.record(previous?.plainVariables)
      : normalizePlainVariables(dto.plainVariables);
    const resourceInputs = dto.resourceReferences === undefined
      ? this.previousResources(previous?.resourceReferences)
      : normalizeResourceReferences(dto.resourceReferences);
    const secretIds = dto.secretReferenceIds ?? this.referenceIds(previous?.secretReferences);
    const policyIds = dto.policyReferenceIds ?? this.referenceIds(previous?.policyReferences);
    return {
      plainVariables,
      secretReferences: await this.resolveSecrets(tx, environment, secretIds),
      resourceReferences: await this.resolveResources(tx, environment, resourceInputs),
      routeSnapshot: dto.routeSnapshot === undefined
        ? this.record(previous?.routeSnapshot)
        : normalizeRouteSnapshot(dto.routeSnapshot),
      policyReferences: await this.resolvePolicies(tx, environment, policyIds),
    };
  }

  private async resolveSecrets(
    tx: Prisma.TransactionClient,
    scope: EnvironmentScope,
    inputIds: string[],
  ) {
    const ids = [...new Set(inputIds)].sort();
    const rows = await tx.secretKey.findMany({
      where: {
        id: { in: ids }, teamId: scope.teamId,
        OR: [{ projectId: null }, { projectId: scope.projectId }],
        AND: [{ OR: [{ environmentId: null }, { environmentId: scope.id }] }],
      },
      select: { id: true, name: true, type: true },
    });
    this.assertComplete("Secret", ids, rows);
    return rows.sort((left, right) => left.id.localeCompare(right.id));
  }

  private async resolveResources(
    tx: Prisma.TransactionClient,
    scope: EnvironmentScope,
    inputs: ResourceReferenceInput[],
  ) {
    const allEnvironmentIds = [...new Set(inputs.flatMap((item) => item.sharedEnvironmentIds))];
    const environments = await tx.projectEnvironment.findMany({
      where: { id: { in: allEnvironmentIds }, teamId: scope.teamId, projectId: scope.projectId },
      select: { id: true },
    });
    this.assertComplete("共享环境", allEnvironmentIds, environments);
    const output: SafeResourceReference[] = [];
    for (const input of inputs) {
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
      const row = await this.findResource(tx, scope, input);
      if (!row) throw new BadRequestException(`资源引用 ${input.kind}:${input.id} 无效或跨项目`);
      if (row.environmentId && !input.sharedEnvironmentIds.includes(row.environmentId)) {
        throw new BadRequestException(`资源 ${input.id} 的所属环境未包含在共享范围`);
      }
      output.push({ ...input, name: row.name });
    }
    return output.sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
  }

  private findResource(
    tx: Prisma.TransactionClient,
    scope: EnvironmentScope,
    input: ResourceReferenceInput,
  ): Promise<{ id: string; name: string; environmentId: string | null } | null> {
    const args = {
      where: { id: input.id, teamId: scope.teamId, projectId: scope.projectId },
      select: { id: true, name: true, environmentId: true },
    };
    if (input.kind === "managed_resource") return tx.managedResource.findFirst(args);
    if (input.kind === "resource_instance") return tx.resourceInstance.findFirst(args);
    if (input.kind === "site") return tx.site.findFirst(args);
    return tx.cDNConfig.findFirst(args);
  }

  private async resolvePolicies(tx: Prisma.TransactionClient, scope: EnvironmentScope, inputIds: string[]) {
    const ids = [...new Set(inputIds)].sort();
    const rows = await tx.controlAccessPolicy.findMany({
      where: {
        id: { in: ids }, teamId: scope.teamId, enabled: true,
        OR: [{ projectId: null }, { projectId: scope.projectId }],
        AND: [{ OR: [{ environmentId: null }, { environmentId: scope.id }] }],
      },
      select: { id: true, name: true, effect: true, actions: true },
    });
    this.assertComplete("策略", ids, rows);
    return rows.sort((left, right) => left.id.localeCompare(right.id));
  }

  private assertComplete(label: string, ids: string[], rows: Array<{ id: string }>) {
    if (rows.length !== ids.length) throw new BadRequestException(`${label} 引用无效或越权`);
  }

  private referenceIds(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) =>
      entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string"
        ? [(entry as { id: string }).id]
        : [],
    );
  }

  private previousResources(value: unknown) {
    return Array.isArray(value) ? normalizeResourceReferences(value) : [];
  }

  private record(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, string>
      : {};
  }
}
