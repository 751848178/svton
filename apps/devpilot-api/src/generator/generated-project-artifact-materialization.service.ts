import { Injectable } from "@nestjs/common";
import { readFile, rm } from "fs/promises";
import { ProjectService } from "../project/project.service";
import type { GenerateProjectRequestDto } from "./dto/generate.dto";
import {
  GeneratedArtifactSelection,
  GeneratedProjectArtifactClaimService,
} from "./generated-project-artifact-claim.service";
import {
  GeneratorService,
  type ProjectZipArtifact,
} from "./generator.service";

interface MaterializeGeneratedArtifactInput {
  teamId: string;
  actorId: string;
  draft: {
    id: string;
    name: string;
    config: unknown;
    idempotencyKey: string;
    inputHash: string;
  };
  dto: GenerateProjectRequestDto;
}

export interface MaterializedGeneratedArtifact {
  projectId: string;
  zipBuffer: Buffer;
  artifact: ProjectZipArtifact;
}

@Injectable()
export class GeneratedProjectArtifactMaterializationService {
  constructor(
    private readonly generator: GeneratorService,
    private readonly projects: ProjectService,
    private readonly claims: GeneratedProjectArtifactClaimService,
  ) {}

  async materialize(
    input: MaterializeGeneratedArtifactInput,
  ): Promise<MaterializedGeneratedArtifact> {
    const attached = readAttachedSelection(input.draft.config);
    const claim = attached
      ? { kind: "selected" as const, ...(await this.claims.adoptSelected(
          input.teamId,
          input.draft.id,
          attached,
        )) }
      : await this.claims.acquire(input.teamId, input.draft.id);
    if (claim.kind === "selected") return this.attachAndRead(input, claim);

    let ownedArtifact: ProjectZipArtifact | undefined;
    let selection: GeneratedArtifactSelection;
    try {
      const resolution = await this.generator.resolveProjectResources(
        input.teamId,
        input.actorId,
        input.draft.id,
        input.dto,
      );
      const files = await this.generator.generateProject(
        input.dto,
        resolution.credentials,
      );
      const zipBuffer = await this.generator.createZipBuffer(files);
      ownedArtifact = await this.generator.persistProjectZipArtifact(
        input.teamId,
        input.draft.id,
        `${claim.ownerToken}-${input.draft.name}`,
        zipBuffer,
      );
      selection = await this.claims.select(
        input.teamId,
        input.draft.id,
        claim.ownerToken,
        { artifact: ownedArtifact, resolvedResources: resolution.summary },
      );
    } catch (error) {
      const recovered = await this.claims.findSelected(input.draft.id);
      if (!recovered) {
        if (ownedArtifact) await this.removeOwned(input, ownedArtifact);
        await this.claims.release(input.teamId, input.draft.id, claim.ownerToken);
        throw error;
      }
      selection = recovered;
    }
    if (ownedArtifact && ownedArtifact.fileName !== selection.artifact.fileName) {
      await this.removeOwned(input, ownedArtifact);
    }
    return this.attachAndRead(input, selection);
  }

  async readAttached(
    teamId: string,
    project: { id: string; name: string; config: unknown },
  ): Promise<MaterializedGeneratedArtifact> {
    const artifact = await this.generator.resolveProjectZipArtifact(
      teamId,
      project.id,
      project.name,
      project.config,
    );
    return { projectId: project.id, zipBuffer: await readFile(artifact.filePath), artifact };
  }

  private async attachAndRead(
    input: MaterializeGeneratedArtifactInput,
    selection: GeneratedArtifactSelection,
  ): Promise<MaterializedGeneratedArtifact> {
    await this.projects.attachGeneratedProjectArtifact(
      input.teamId,
      input.draft.id,
      {
        ...input.dto,
        generationRequest: {
          idempotencyKey: input.draft.idempotencyKey,
          inputHash: input.draft.inputHash,
        },
        resolvedResources: selection.resolvedResources,
      },
      selection.artifact,
    );
    const resolved = await this.generator.resolveProjectZipArtifact(
      input.teamId,
      input.draft.id,
      input.draft.name,
      { generatedArtifact: selection.artifact },
    );
    return {
      projectId: input.draft.id,
      zipBuffer: await readFile(resolved.filePath),
      artifact: resolved,
    };
  }

  private async removeOwned(
    input: MaterializeGeneratedArtifactInput,
    artifact: ProjectZipArtifact,
  ): Promise<void> {
    const resolved = await this.generator.resolveProjectZipArtifact(
      input.teamId,
      input.draft.id,
      input.draft.name,
      { generatedArtifact: artifact },
    );
    await rm(resolved.filePath, { force: true });
  }
}

function readAttachedSelection(config: unknown): GeneratedArtifactSelection | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const value = config as Record<string, unknown>;
  const artifact = value.generatedArtifact as ProjectZipArtifact | undefined;
  if (!artifact || artifact.kind !== "project_zip" || !artifact.fileName) return null;
  return { artifact, resolvedResources: value.resolvedResources ?? [] };
}
