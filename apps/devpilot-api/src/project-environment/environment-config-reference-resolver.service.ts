import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateEnvironmentConfigRevisionDto } from "./dto/environment-config-revision.dto";
import type {
  EnvironmentConfigSnapshot,
  SecretReferenceInput,
} from "./environment-config-revision.types";
import { resolveEnvironmentConfigResources } from "./environment-config-resource-resolver";
import { normalizeSecretReferences } from "./environment-config-reference-normalizer";
import {
  normalizePlainVariables,
  normalizeResourceReferences,
  normalizeRouteSnapshot,
} from "./environment-config-revision.utils";
import { validateRouteSnapshotTargets } from './environment-route-target-validator';
import { secretTargetEnvKey } from "./environment-variable-binding.utils";
import {
  environmentVariableCollisionMessage,
  findEnvironmentVariableCollisions,
  type EnvironmentVariableOwner,
} from "./environment-variable-ownership.model";
import { normalizeEnvironmentObservabilitySnapshot } from "./environment-observability-snapshot.policy";

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
  observabilitySnapshot?: unknown;
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
    const secretInputs = this.secretInputs(dto, previous?.secretReferences);
    const policyIds = dto.policyReferenceIds ?? this.referenceIds(previous?.policyReferences);
    const routeSnapshot = dto.routeSnapshot === undefined
      ? this.record(previous?.routeSnapshot)
      : normalizeRouteSnapshot(dto.routeSnapshot);
    await validateRouteSnapshotTargets(tx, environment, routeSnapshot);
    const secretReferences = await this.resolveSecrets(tx, environment, secretInputs);
    const resources = await resolveEnvironmentConfigResources(tx, environment, resourceInputs);
    this.assertVariableOwnership(plainVariables, secretReferences, resources.owners);
    return {
      plainVariables,
      secretReferences,
      resourceReferences: resources.references,
      routeSnapshot,
      policyReferences: await this.resolvePolicies(tx, environment, policyIds),
      observabilitySnapshot: normalizeEnvironmentObservabilitySnapshot(
        dto.observabilitySnapshot === undefined
          ? previous?.observabilitySnapshot
          : dto.observabilitySnapshot,
      ),
    };
  }

  private async resolveSecrets(
    tx: Prisma.TransactionClient,
    scope: EnvironmentScope,
    inputs: SecretReferenceInput[],
  ) {
    const ids = [...new Set(inputs.map((item) => item.id))].sort();
    const rows = await tx.secretKey.findMany({
      where: {
        id: { in: ids }, teamId: scope.teamId,
        OR: [{ projectId: null }, { projectId: scope.projectId }],
        AND: [{ OR: [{ environmentId: null }, { environmentId: scope.id }] }],
      },
      select: { id: true, name: true, type: true },
    });
    this.assertComplete("Secret", ids, rows);
    const inputById = new Map(inputs.map((item) => [item.id, item]));
    return rows
      .map((row) => ({ ...row, ...inputById.get(row.id) }))
      .sort((left, right) => left.id.localeCompare(right.id));
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

  private secretInputs(dto: CreateEnvironmentConfigRevisionDto, previous: unknown) {
    if (dto.secretReferences !== undefined) {
      return normalizeSecretReferences(dto.secretReferences);
    }
    if (dto.secretReferenceIds !== undefined) {
      return dto.secretReferenceIds.map((id) => ({ id }));
    }
    return Array.isArray(previous)
      ? normalizeSecretReferences(previous)
      : [];
  }

  private assertVariableOwnership(
    plainVariables: Record<string, string>,
    secrets: Array<{ id: string; name: string; targetEnvKey?: string }>,
    resourceOwners: EnvironmentVariableOwner[],
  ) {
    const owners: EnvironmentVariableOwner[] = [
      ...resourceOwners,
      ...Object.keys(plainVariables).map((key) => ({
        key, source: "plain" as const, reference: key, scope: "global",
      })),
      ...secrets.map((secret) => ({
        key: secretTargetEnvKey(secret), source: "secret" as const,
        reference: secret.id, scope: "global",
      })),
    ];
    const collision = findEnvironmentVariableCollisions(owners)[0];
    if (collision) {
      throw new BadRequestException(environmentVariableCollisionMessage(collision));
    }
  }

  private previousResources(value: unknown) {
    return Array.isArray(value) ? normalizeResourceReferences(value, false) : [];
  }

  private record(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, string>
      : {};
  }
}
