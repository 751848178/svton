import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { ProjectService } from './project.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableProjectRecord = {
  id: string;
};

type ProjectScopedRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
  environment?: { id?: string | null } | null;
  projectEnvironment?: { id?: string | null } | null;
};

type ProjectApplicationServiceRecord = ProjectScopedRecord;

type ProjectApplicationRecord = ProjectScopedRecord & {
  services?: ProjectApplicationServiceRecord[];
};

type ProjectDetailRecord = ReadableProjectRecord & {
  environments?: ProjectScopedRecord[];
  proxyConfigs?: ProjectScopedRecord[];
  sites?: ProjectScopedRecord[];
  applications?: ProjectApplicationRecord[];
  cdnConfigs?: ProjectScopedRecord[];
  managedResources?: ProjectScopedRecord[];
  resourceInstances?: ProjectScopedRecord[];
  secretKeys?: ProjectScopedRecord[];
};

@Controller('projects')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Post()
  async create(@Request() req: AuthRequest, @Body() dto: CreateProjectDto) {
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'project',
      action: 'project.create',
      targetType: 'project',
      risk: 'medium',
    });
    return this.projectService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  async findAll(@Request() req: AuthRequest) {
    const projects = await this.projectService.findAll(req.teamId);
    return this.filterReadableProjects(req, projects);
  }

  @Get(':id')
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    const project = await this.projectService.findOne(req.teamId, id);
    await this.assertCanReadProject(req, id);
    return this.withReadableProjectChildren(req, project);
  }

  @Put(':id')
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: id,
      category: 'project',
      action: 'project.update',
      targetType: 'project',
      targetId: id,
      risk: 'medium',
    });
    return this.projectService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: id,
      category: 'project',
      action: 'project.delete',
      targetType: 'project',
      targetId: id,
      risk: 'high',
    });
    return this.projectService.remove(req.teamId, id);
  }

  private assertCanReadProject(req: AuthRequest, projectId: string) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      category: 'project',
      action: 'project.read',
      targetType: 'project',
      targetId: projectId,
      risk: 'low',
    });
  }

  private async filterReadableProjects<T extends ReadableProjectRecord>(
    req: AuthRequest,
    projects: T[],
  ) {
    const allowed = await Promise.all(projects.map(async (project) => ({
      project,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: project.id,
        category: 'project',
        action: 'project.read',
        targetType: 'project',
        targetId: project.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.project);
  }

  private async withReadableProjectChildren<T extends ProjectDetailRecord>(
    req: AuthRequest,
    project: T,
  ) {
    const [
      environments,
      proxyConfigs,
      sites,
      applications,
      cdnConfigs,
      managedResources,
      resourceInstances,
      secretKeys,
    ] = await Promise.all([
      this.filterReadableScopedRecords(
        req,
        project.environments,
        project.id,
        'project_environment',
        'project_environment.read',
        'project_environment',
      ),
      this.filterReadableScopedRecords(req, project.proxyConfigs, project.id, 'site', 'proxy_config.read', 'proxy_config'),
      this.filterReadableScopedRecords(req, project.sites, project.id, 'site', 'site.read', 'site'),
      this.filterReadableProjectApplications(req, project.applications, project.id),
      this.filterReadableScopedRecords(req, project.cdnConfigs, project.id, 'cdn', 'cdn_config.read', 'cdn_config'),
      this.filterReadableScopedRecords(req, project.managedResources, project.id, 'resource', 'resource.read', 'managed_resource'),
      this.filterReadableScopedRecords(
        req,
        project.resourceInstances,
        project.id,
        'resource_instance',
        'resource_instance.read',
        'resource_instance',
      ),
      this.filterReadableScopedRecords(req, project.secretKeys, project.id, 'secret_key', 'secret_key.read', 'secret_key'),
    ]);

    return {
      ...project,
      environments,
      proxyConfigs,
      sites,
      applications,
      cdnConfigs,
      managedResources,
      resourceInstances,
      secretKeys,
    };
  }

  private async filterReadableProjectApplications<T extends ProjectApplicationRecord>(
    req: AuthRequest,
    applications: T[] | undefined,
    fallbackProjectId: string,
  ) {
    const readableApplications = await this.filterReadableScopedRecords(
      req,
      applications,
      fallbackProjectId,
      'application',
      'application.read',
      'application',
    );

    return Promise.all(readableApplications.map(async (application) => {
      if (!application.services) {
        return application;
      }

      const services = await this.filterReadableScopedRecords(
        req,
        application.services,
        application.projectId || fallbackProjectId,
        'application_service',
        'application_service.read',
        'application_service',
      );
      return { ...application, services };
    }));
  }

  private async filterReadableScopedRecords<T extends ProjectScopedRecord>(
    req: AuthRequest,
    records: T[] | undefined,
    fallbackProjectId: string,
    category: string,
    action: string,
    targetType: string,
  ) {
    if (!records) {
      return [];
    }

    const allowed = await Promise.all(records.map(async (record) => {
      const scope = this.getRecordScope(record, fallbackProjectId, targetType);
      return {
        record,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: scope.projectId,
          environmentId: scope.environmentId,
          category,
          action,
          targetType,
          targetId: record.id,
          risk: 'low',
        }),
      };
    }));

    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }

  private getRecordScope(record: ProjectScopedRecord, fallbackProjectId: string, targetType: string) {
    return {
      projectId: record.projectId ?? fallbackProjectId,
      environmentId:
        record.environmentId ??
        record.environment?.id ??
        record.projectEnvironment?.id ??
        (targetType === 'project_environment' ? record.id : null),
    };
  }
}
