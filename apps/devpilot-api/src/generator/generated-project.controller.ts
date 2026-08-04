import { Body, Controller, Post, Request, Res, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ControlAccessPolicyService } from "../control-access-policy";
import { GenerateProjectRequestDto } from "./dto/generate.dto";
import { GeneratedProjectCreationService } from "./generated-project-creation.service";
import type { GenerateProjectRequest } from "./generator-request.types";

@Controller("projects")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class GeneratedProjectController {
  constructor(
    private readonly creation: GeneratedProjectCreationService,
    private readonly accessPolicy: ControlAccessPolicyService,
  ) {}

  @Post("generate")
  async generateProject(
    @Body() dto: GenerateProjectRequestDto,
    @Request() req: GenerateProjectRequest,
    @Res() res: Response,
  ) {
    await this.accessPolicy.assertCanSelfServiceWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: "project",
      action: "project.generate",
      targetType: "project",
      risk: "medium",
    });
    const result = await this.creation.create(req.teamId, req.user.id, dto);
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.artifact.fileName}"`,
      "Content-Length": result.zipBuffer.length,
      "X-Project-Id": result.projectId,
      "X-Project-Download-Url": result.artifact.downloadUrl,
      "X-Project-Artifact-Expires-At": result.artifact.expiresAt,
      "Access-Control-Expose-Headers":
        "Content-Disposition, Content-Length, X-Project-Id, X-Project-Download-Url, X-Project-Artifact-Expires-At",
    });
    res.send(result.zipBuffer);
  }
}
