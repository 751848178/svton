import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import type {
  FinalizeProjectIntakeInput,
  FinalizedBaselineEnvironment,
} from "./project-intake.types";

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

@Injectable()
export class ProjectIntakeBaselineFinalizerService {
  async ensure(
    tx: Prisma.TransactionClient,
    input: FinalizeProjectIntakeInput,
  ): Promise<FinalizedBaselineEnvironment[]> {
    const results: FinalizedBaselineEnvironment[] = [];
    for (const baseline of BASELINES) {
      results.push(await this.ensureOne(tx, input, baseline));
    }
    return results;
  }

  private async ensureOne(
    tx: Prisma.TransactionClient,
    input: FinalizeProjectIntakeInput,
    baseline: (typeof BASELINES)[number],
  ): Promise<FinalizedBaselineEnvironment> {
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
      update: { baselineRole: baseline.role },
    });
    const snapshotHash = createHash("sha256")
      .update(JSON.stringify(EMPTY_SNAPSHOT))
      .digest("hex");
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
        snapshotHash,
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
    return {
      id: environment.id,
      key: baseline.key,
      baselineRole: baseline.role,
      configRevisionId: environment.currentConfigRevisionId ?? revision.id,
    };
  }
}
