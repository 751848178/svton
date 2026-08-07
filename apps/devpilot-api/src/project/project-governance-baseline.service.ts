import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import type { GovernedBaselineEnvironment } from "./project-governance-finalization.types";

const BASELINES = [
  { key: "staging", role: "staging", name: "Staging", sortOrder: 10 },
  { key: "production", role: "production", name: "Production", sortOrder: 20 },
] as const;

const EMPTY_SNAPSHOT = {
  plainVariables: {},
  secretReferences: [],
  resources: [],
  routes: [],
  policies: [],
};

const EMPTY_SNAPSHOT_HASH = createHash("sha256")
  .update(JSON.stringify(EMPTY_SNAPSHOT))
  .digest("hex");

@Injectable()
export class ProjectGovernanceBaselineService {
  async ensure(
    tx: Prisma.TransactionClient,
    input: { teamId: string; projectId: string; actorId: string },
  ): Promise<GovernedBaselineEnvironment[]> {
    const results: GovernedBaselineEnvironment[] = [];
    for (const baseline of BASELINES) {
      const environment = await tx.projectEnvironment.upsert({
        where: {
          projectId_key: { projectId: input.projectId, key: baseline.key },
        },
        create: {
          teamId: input.teamId,
          projectId: input.projectId,
          key: baseline.key,
          name: baseline.name,
          status: "active",
          sortOrder: baseline.sortOrder,
          baselineRole: baseline.role,
        },
        update: {
          sortOrder: baseline.sortOrder,
          baselineRole: baseline.role,
        },
      });
      const revision = await tx.environmentConfigRevision.upsert({
        where: {
          environmentId_revision: { environmentId: environment.id, revision: 1 },
        },
        create: {
          teamId: input.teamId,
          projectId: input.projectId,
          environmentId: environment.id,
          createdById: input.actorId,
          revision: 1,
          snapshotHash: EMPTY_SNAPSHOT_HASH,
          plainVariables: EMPTY_SNAPSHOT.plainVariables,
          secretReferences: EMPTY_SNAPSHOT.secretReferences,
          resourceReferences: EMPTY_SNAPSHOT.resources,
          routeSnapshot: EMPTY_SNAPSHOT.routes,
          policyReferences: EMPTY_SNAPSHOT.policies,
        },
        update: {},
      });
      if (!environment.currentConfigRevisionId) {
        await tx.projectEnvironment.update({
          where: { id: environment.id },
          data: { currentConfigRevisionId: revision.id },
        });
      }
      results.push({
        id: environment.id,
        key: baseline.key,
        baselineRole: baseline.role,
        configRevisionId: environment.currentConfigRevisionId ?? revision.id,
      });
    }
    return results;
  }
}
