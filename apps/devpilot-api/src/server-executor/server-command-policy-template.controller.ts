import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import {
  CreateServerCommandPolicyTemplateDto,
  ListServerCommandPolicyTemplatesQueryDto,
  UpdateServerCommandPolicyTemplateDto,
} from './dto/server-command-policy-template.dto';
import { ServerCommandPolicyService } from './server-command-policy.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableCommandPolicyTemplate = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
};

@Controller('server-command-policy-templates')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ServerCommandPolicyTemplateController {
  constructor(
    private readonly commandPolicyService: ServerCommandPolicyService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async list(
    @Request() req: AuthRequest,
    @Query() query: ListServerCommandPolicyTemplatesQueryDto,
  ) {
    const templates = await this.commandPolicyService.listTemplates(req.teamId, query);
    return this.filterReadableTemplates(req, templates);
  }

  @Post()
  @Roles('team_admin')
  async create(@Request() req: AuthRequest, @Body() dto: CreateServerCommandPolicyTemplateDto) {
    await this.assertCanWriteTemplate(req, 'server_command_policy_template.create', null, dto.projectId, dto.environmentId);
    return this.commandPolicyService.createTemplate(req.teamId, req.user.id, dto);
  }

  @Patch(':id')
  @Roles('team_admin')
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateServerCommandPolicyTemplateDto,
  ) {
    const currentScope = await this.commandPolicyService.getTemplateAccessScope(req.teamId, id);
    await this.assertCanWriteTemplate(
      req,
      'server_command_policy_template.update',
      id,
      currentScope.projectId,
      currentScope.environmentId,
    );
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      await this.assertCanWriteTemplate(
        req,
        'server_command_policy_template.update',
        id,
        dto.projectId !== undefined ? dto.projectId : currentScope.projectId,
        dto.environmentId !== undefined ? dto.environmentId : currentScope.environmentId,
      );
    }
    return this.commandPolicyService.updateTemplate(req.teamId, id, dto);
  }

  @Delete(':id')
  @Roles('team_admin')
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.commandPolicyService.getTemplateAccessScope(req.teamId, id);
    await this.assertCanWriteTemplate(
      req,
      'server_command_policy_template.delete',
      id,
      scope.projectId,
      scope.environmentId,
      'high',
    );
    return this.commandPolicyService.deleteTemplate(req.teamId, id);
  }

  private async filterReadableTemplates<T extends ReadableCommandPolicyTemplate>(
    req: AuthRequest,
    templates: T[],
  ) {
    const allowed = await Promise.all(templates.map(async (template) => ({
      template,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: template.projectId,
        environmentId: template.environmentId,
        category: 'execution',
        action: 'server_command_policy_template.read',
        targetType: 'server_command_policy_template',
        targetId: template.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.template);
  }

  private assertCanWriteTemplate(
    req: AuthRequest,
    action: string,
    templateId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'execution',
      action,
      targetType: 'server_command_policy_template',
      targetId: templateId,
      risk,
    });
  }
}
