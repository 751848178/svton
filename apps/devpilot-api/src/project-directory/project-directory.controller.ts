import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import { AuthzGuard, Roles } from "@svton/nestjs-authz";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectDirectoryQueryDto } from "./dto/project-directory-query.dto";
import { ProjectDirectoryService } from "./project-directory.service";

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller("project-directory")
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles("team_member")
export class ProjectDirectoryController {
  constructor(private readonly directory: ProjectDirectoryService) {}

  @Get()
  list(@Request() req: AuthRequest, @Query() query: ProjectDirectoryQueryDto) {
    return this.directory.list(req.teamId, req.user.id, query);
  }
}
