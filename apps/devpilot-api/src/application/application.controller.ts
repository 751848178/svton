import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { ApplicationService } from './application.service';
import {
  CreateApplicationDto,
  CreateApplicationServiceDto,
  ExecuteApplicationServiceOperationDto,
  ListApplicationsQueryDto,
  UpdateApplicationDto,
  UpdateApplicationServiceDto,
} from './dto/application.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableApplicationOperationRecord = {
  id: string;
  projectId: string;
  environmentId?: string | null;
};

type ReadableApplicationServiceRecord = {
  id: string;
  projectId: string;
  environmentId: string;
  operationRuns?: ReadableApplicationOperationRecord[];
};

type ReadableApplicationRecord = {
  id: string;
  projectId: string;
  services?: ReadableApplicationServiceRecord[];
};

@Controller('applications')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async list(@Request() req: AuthRequest, @Query() query: ListApplicationsQueryDto) {
    const applications = await this.applicationService.list(req.teamId, query);
    return this.filterReadableApplications(req, applications);
  }

  @Post()
  async create(@Request() req: AuthRequest, @Body() dto: CreateApplicationDto) {
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: dto.projectId,
      category: 'application',
      action: 'application.create',
      targetType: 'application',
      risk: 'medium',
    });
    return this.applicationService.create(req.teamId, req.user.id, dto);
  }

  @Get(':id')
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    const application = await this.applicationService.findOne(req.teamId, id);
    await this.assertCanReadApplication(req, 'application.read', id, application.projectId);
    return this.withReadableApplicationChildren(req, application);
  }

  @Put(':id')
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    const scope = await this.applicationService.getApplicationAccessScope(req.teamId, id);
    await this.assertCanWriteApplication(req, 'application.update', id, scope.projectId, 'medium');
    return this.applicationService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  async archive(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.applicationService.getApplicationAccessScope(req.teamId, id);
    await this.assertCanWriteApplication(req, 'application.archive', id, scope.projectId, 'high');
    return this.applicationService.archive(req.teamId, id);
  }

  @Post(':id/services')
  async createService(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateApplicationServiceDto,
  ) {
    const scope = await this.applicationService.resolveServiceCreateAccessScope(req.teamId, id, dto.environmentId);
    await this.assertCanWriteApplicationService(
      req,
      'application_service.create',
      id,
      null,
      scope.projectId,
      scope.environmentId,
      'medium',
    );
    return this.applicationService.createService(req.teamId, id, dto);
  }

  @Put(':id/services/:serviceId')
  async updateService(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateApplicationServiceDto,
  ) {
    const currentScope = await this.applicationService.getServiceAccessScope(req.teamId, id, serviceId);
    await this.assertCanWriteApplicationService(
      req,
      'application_service.update',
      id,
      serviceId,
      currentScope.projectId,
      currentScope.environmentId,
      'medium',
    );
    if (dto.environmentId && dto.environmentId !== currentScope.environmentId) {
      const targetScope = await this.applicationService.resolveServiceCreateAccessScope(req.teamId, id, dto.environmentId);
      await this.assertCanWriteApplicationService(
        req,
        'application_service.update',
        id,
        serviceId,
        targetScope.projectId,
        targetScope.environmentId,
        'medium',
      );
    }
    return this.applicationService.updateService(req.teamId, id, serviceId, dto);
  }

  @Delete(':id/services/:serviceId')
  async archiveService(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
  ) {
    const scope = await this.applicationService.getServiceAccessScope(req.teamId, id, serviceId);
    await this.assertCanWriteApplicationService(
      req,
      'application_service.archive',
      id,
      serviceId,
      scope.projectId,
      scope.environmentId,
      'high',
    );
    return this.applicationService.archiveService(req.teamId, id, serviceId);
  }

  @Get(':id/services/:serviceId/operations')
  async listServiceOperations(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
  ) {
    const scope = await this.applicationService.getServiceAccessScope(req.teamId, id, serviceId);
    await this.assertCanReadApplicationService(req, 'application_service.read', serviceId, scope.projectId, scope.environmentId);
    const operations = await this.applicationService.listServiceOperations(req.teamId, id, serviceId);
    return this.filterReadableApplicationOperations(req, operations);
  }

  @Post(':id/services/:serviceId/operations')
  async executeServiceOperation(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: ExecuteApplicationServiceOperationDto,
  ) {
    const scope = await this.applicationService.getServiceAccessScope(req.teamId, id, serviceId);
    await this.assertCanWriteApplicationService(
      req,
      `application_service.operation.${dto.action}`,
      id,
      serviceId,
      scope.projectId,
      scope.environmentId,
      this.serviceOperationRisk(dto),
    );
    return this.applicationService.executeServiceOperation(
      req.teamId,
      req.user.id,
      id,
      serviceId,
      dto,
    );
  }

  private assertCanWriteApplication(
    req: AuthRequest,
    action: string,
    applicationId: string,
    projectId: string,
    risk: string,
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      category: 'application',
      action,
      targetType: 'application',
      targetId: applicationId,
      risk,
    });
  }

  private assertCanWriteApplicationService(
    req: AuthRequest,
    action: string,
    applicationId: string,
    serviceId: string | null,
    projectId: string,
    environmentId: string,
    risk: string,
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'application_service',
      action,
      targetType: serviceId ? 'application_service' : 'application',
      targetId: serviceId || applicationId,
      risk,
    });
  }

  private assertCanReadApplication(
    req: AuthRequest,
    action: string,
    applicationId: string,
    projectId: string,
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      category: 'application',
      action,
      targetType: 'application',
      targetId: applicationId,
      risk: 'low',
    });
  }

  private assertCanReadApplicationService(
    req: AuthRequest,
    action: string,
    serviceId: string,
    projectId: string,
    environmentId: string,
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'application_service',
      action,
      targetType: 'application_service',
      targetId: serviceId,
      risk: 'low',
    });
  }

  private async filterReadableApplications<T extends ReadableApplicationRecord>(
    req: AuthRequest,
    applications: T[],
  ) {
    const allowed = await Promise.all(applications.map(async (application) => ({
      application,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: application.projectId,
        category: 'application',
        action: 'application.read',
        targetType: 'application',
        targetId: application.id,
        risk: 'low',
      }),
    })));

    const readable = allowed.filter((item) => item.allowed).map((item) => item.application);
    return Promise.all(readable.map((application) => this.withReadableApplicationChildren(req, application)));
  }

  private async withReadableApplicationChildren<T extends ReadableApplicationRecord>(
    req: AuthRequest,
    application: T,
  ) {
    if (!application.services) {
      return application;
    }

    const services = await this.filterReadableApplicationServices(req, application.services);
    return { ...application, services };
  }

  private async filterReadableApplicationServices<T extends ReadableApplicationServiceRecord>(
    req: AuthRequest,
    services: T[],
  ) {
    const allowed = await Promise.all(services.map(async (service) => ({
      service,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: service.projectId,
        environmentId: service.environmentId,
        category: 'application_service',
        action: 'application_service.read',
        targetType: 'application_service',
        targetId: service.id,
        risk: 'low',
      }),
    })));

    const readable = allowed.filter((item) => item.allowed).map((item) => item.service);
    return Promise.all(readable.map(async (service) => {
      if (!service.operationRuns) {
        return service;
      }
      const operationRuns = await this.filterReadableApplicationOperations(req, service.operationRuns);
      return { ...service, operationRuns };
    }));
  }

  private async filterReadableApplicationOperations<T extends ReadableApplicationOperationRecord>(
    req: AuthRequest,
    operations: T[],
  ) {
    const allowed = await Promise.all(operations.map(async (operation) => ({
      operation,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: operation.projectId,
        environmentId: operation.environmentId,
        category: 'application_service',
        action: 'application_service_operation_run.read',
        targetType: 'application_service_operation_run',
        targetId: operation.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.operation);
  }

  private serviceOperationRisk(dto: ExecuteApplicationServiceOperationDto) {
    if (dto.action === 'restart' || dto.action === 'rollback') {
      return dto.dryRun === false ? 'high' : 'medium';
    }
    return 'low';
  }
}
