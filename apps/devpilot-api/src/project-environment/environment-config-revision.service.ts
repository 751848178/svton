import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CopyEnvironmentConfigRevisionDto,
  CreateEnvironmentConfigRevisionDto,
} from "./dto/environment-config-revision.dto";
import { EnvironmentConfigCopyService } from "./environment-config-copy.service";
import { EnvironmentConfigIdentityService } from "./environment-config-identity.service";
import { EnvironmentConfigReferenceResolverService } from "./environment-config-reference-resolver.service";
import { ENVIRONMENT_CONFIG_REVISION_SELECT } from "./environment-config-revision-selects";
import { writeEnvironmentConfigRevision } from "./environment-config-revision-write";

@Injectable()
export class EnvironmentConfigRevisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EnvironmentConfigReferenceResolverService,
    private readonly identities: EnvironmentConfigIdentityService = new EnvironmentConfigIdentityService(
      prisma,
    ),
    private readonly copies: EnvironmentConfigCopyService = new EnvironmentConfigCopyService(
      prisma,
    ),
  ) {}

  async list(teamId: string, environmentId: string) {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: { id: environmentId, teamId },
      select: { id: true, currentConfigRevisionId: true },
    });
    if (!environment) throw new NotFoundException("项目环境不存在");
    const revisions = await this.prisma.environmentConfigRevision.findMany({
      where: { teamId, environmentId },
      orderBy: { revision: "desc" },
      select: ENVIRONMENT_CONFIG_REVISION_SELECT,
    });
    return {
      environmentId,
      currentConfigRevisionId: environment.currentConfigRevisionId,
      revisions: revisions.map((revision) => ({
        ...revision,
        current: revision.id === environment.currentConfigRevisionId,
      })),
    };
  }

  create(
    teamId: string,
    actorId: string,
    environmentId: string,
    dto: CreateEnvironmentConfigRevisionDto,
  ) {
    return this.prisma.$transaction(
      (tx) =>
        writeEnvironmentConfigRevision(
          tx,
          this.resolver,
          teamId,
          actorId,
          environmentId,
          dto,
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  updateIdentity(
    teamId: string,
    actorId: string,
    environmentId: string,
    input: {
      name?: string;
      description?: string | null;
      reason?: string;
      expectedCurrentRevisionId?: string;
    },
  ) {
    return this.identities.update(teamId, actorId, environmentId, input);
  }

  async copyToEnvironments(
    teamId: string,
    actorId: string,
    environmentId: string,
    dto: CopyEnvironmentConfigRevisionDto,
  ) {
    return this.copies.copy(
      teamId,
      actorId,
      environmentId,
      dto,
      (nextTeamId, nextActorId, nextEnvironmentId, input) =>
        this.create(nextTeamId, nextActorId, nextEnvironmentId, input),
    );
  }
}
