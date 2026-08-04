import { Body, Controller, HttpCode, Post, Request, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { AuditEventService } from "../audit-event";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ControlAccessPolicyService } from "../control-access-policy";
import { CleanGeneratedProjectArtifactsDto } from "./dto/generate.dto";
import type { GenerateProjectRequest } from "./generator-request.types";
import { GeneratorService } from "./generator.service";

@Controller("projects")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class GeneratedProjectArtifactCleanupController {
  constructor(
    private readonly generator: GeneratorService,
    private readonly accessPolicy: ControlAccessPolicyService,
    private readonly auditEvents: AuditEventService,
  ) {}

  @Post("artifacts/cleanup")
  @HttpCode(200)
  async cleanupGeneratedProjectArtifacts(
    @Body() dto: CleanGeneratedProjectArtifactsDto,
    @Request() req: GenerateProjectRequest,
  ) {
    const dryRun = dto.dryRun ?? true;
    await this.accessPolicy.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: dto.projectId,
      category: "project",
      action: "project.artifact.cleanup",
      targetType: "project_artifact",
      targetId: dto.projectId ?? "generated-projects-local",
      risk: dryRun ? "low" : "high",
    });
    const result = await this.generator.cleanupExpiredProjectZipArtifacts({
      dryRun,
      teamId: req.teamId,
      projectId: dto.projectId,
    });
    const artifacts = result.artifacts.map((artifact) => ({
      teamId: artifact.teamId,
      projectId: artifact.projectId,
      fileName: artifact.fileName,
      size: artifact.size,
      generatedAt: artifact.generatedAt,
      expiresAt: artifact.expiresAt,
      deleted: artifact.deleted,
    }));
    await this.auditEvents.create({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: dto.projectId,
      category: "project",
      action: "project.artifact.cleanup",
      targetType: "project_artifact",
      targetId: dto.projectId ?? "generated-projects-local",
      risk: dryRun ? "low" : "high",
      status: "completed",
      summary: dryRun
        ? `Dry-run found ${result.expired} expired generated project artifacts`
        : `Deleted ${result.deleted} expired generated project artifacts`,
      metadata: {
        dryRun,
        scanned: result.scanned,
        expired: result.expired,
        deleted: result.deleted,
        projectId: dto.projectId ?? null,
        artifacts: artifacts.slice(0, 20),
        artifactsTruncated: artifacts.length > 20,
      },
    });
    return {
      dryRun: result.dryRun,
      scanned: result.scanned,
      expired: result.expired,
      deleted: result.deleted,
      artifacts,
    };
  }
}
