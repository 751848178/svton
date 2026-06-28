import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import {
  CreateProjectWebhookDto,
  ListProjectWebhooksQueryDto,
  ListWebhookDeliveriesQueryDto,
  UpdateProjectWebhookDto,
} from './dto/project-webhook.dto';
import { ProjectWebhookService } from './project-webhook.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableProjectWebhook = {
  id: string;
  projectId: string;
  environmentId?: string | null;
};

type ReadableWebhookDelivery = {
  id: string;
  projectId: string;
  webhook?: {
    environmentId?: string | null;
  } | null;
  deploymentRun?: {
    environmentId?: string | null;
  } | null;
};

type RawBodyRequest = ExpressRequest & { rawBody?: Buffer };

@Controller('project-webhooks')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ProjectWebhookController {
  constructor(
    private readonly webhookService: ProjectWebhookService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async listWebhooks(
    @Request() req: AuthRequest,
    @Query() query: ListProjectWebhooksQueryDto,
  ) {
    const webhooks = await this.webhookService.listWebhooks(req.teamId, query);
    return this.filterReadableWebhooks(req, webhooks);
  }

  @Post()
  async createWebhook(
    @Request() req: AuthRequest,
    @Body() dto: CreateProjectWebhookDto,
  ) {
    const scope = await this.webhookService.resolveWebhookCreateAccessScope(req.teamId, dto);
    await this.assertCanWriteWebhook(
      req,
      'project_webhook.create',
      null,
      scope.projectId,
      scope.environmentId,
      'medium',
    );
    return this.webhookService.createWebhook(req.teamId, req.user.id, dto);
  }

  @Patch(':id')
  async updateWebhook(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProjectWebhookDto,
  ) {
    const currentScope = await this.webhookService.getWebhookAccessScope(req.teamId, id);
    await this.assertCanWriteWebhook(
      req,
      'project_webhook.update',
      id,
      currentScope.projectId,
      currentScope.environmentId,
      'medium',
    );
    if (dto.environmentId !== undefined) {
      const targetScope = await this.webhookService.resolveWebhookUpdateAccessScope(req.teamId, id, dto);
      if (
        targetScope.projectId !== currentScope.projectId ||
        targetScope.environmentId !== currentScope.environmentId
      ) {
        await this.assertCanWriteWebhook(
          req,
          'project_webhook.update',
          id,
          targetScope.projectId,
          targetScope.environmentId,
          'medium',
        );
      }
    }
    return this.webhookService.updateWebhook(req.teamId, id, dto);
  }

  @Post(':id/rotate-secret')
  async rotateWebhookSecret(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    const scope = await this.webhookService.getWebhookAccessScope(req.teamId, id);
    await this.assertCanWriteWebhook(
      req,
      'project_webhook.secret.rotate',
      id,
      scope.projectId,
      scope.environmentId,
      'high',
    );
    return this.webhookService.rotateWebhookSecret(req.teamId, id);
  }

  @Get('deliveries')
  async listDeliveries(
    @Request() req: AuthRequest,
    @Query() query: ListWebhookDeliveriesQueryDto,
  ) {
    const deliveries = await this.webhookService.listDeliveries(req.teamId, query);
    return this.filterReadableDeliveries(req, deliveries);
  }

  private assertCanWriteWebhook(
    req: AuthRequest,
    action: string,
    webhookId: string | null,
    projectId: string,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'deployment',
      action,
      targetType: 'project_webhook',
      targetId: webhookId,
      risk,
    });
  }

  private async filterReadableWebhooks<T extends ReadableProjectWebhook>(
    req: AuthRequest,
    webhooks: T[],
  ) {
    const allowed = await Promise.all(webhooks.map(async (webhook) => ({
      webhook,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: webhook.projectId,
        environmentId: webhook.environmentId,
        category: 'deployment',
        action: 'project_webhook.read',
        targetType: 'project_webhook',
        targetId: webhook.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.webhook);
  }

  private async filterReadableDeliveries<T extends ReadableWebhookDelivery>(
    req: AuthRequest,
    deliveries: T[],
  ) {
    const allowed = await Promise.all(deliveries.map(async (delivery) => ({
      delivery,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: delivery.projectId,
        environmentId: delivery.webhook?.environmentId ?? delivery.deploymentRun?.environmentId ?? null,
        category: 'deployment',
        action: 'webhook_delivery.read',
        targetType: 'webhook_delivery',
        targetId: delivery.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.delivery);
  }
}

@Controller('webhooks/git')
export class PublicGitWebhookController {
  constructor(private readonly webhookService: ProjectWebhookService) {}

  @Post(':token')
  receiveGitWebhook(
    @Param('token') token: string,
    @Body() payload: unknown,
    @Req() req: RawBodyRequest,
  ) {
    return this.webhookService.receiveGitWebhook(
      token,
      payload,
      req.headers,
      req.ip,
      req.rawBody,
    );
  }
}
