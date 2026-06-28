import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentService } from '../deployment/deployment.service';
import {
  CreateProjectWebhookDto,
  ListProjectWebhooksQueryDto,
  ListWebhookDeliveriesQueryDto,
  UpdateProjectWebhookDto,
} from './dto/project-webhook.dto';

type HeaderBag = Record<string, string | string[] | undefined>;

type StoredWebhookSecret = {
  version: 1;
  hash: string;
  encryptedSecret: string;
  createdAt?: string;
  rotatedAt?: string;
};

type PreviewWebhookContext = {
  isPreviewEvent: boolean;
  action?: string;
  state?: string;
  merged?: boolean;
  pullRequestNumber?: number;
  title?: string;
  url?: string;
  sourceBranch?: string;
  targetBranch?: string;
  headSha?: string;
};

type PreviewEnvironmentRef = {
  id: string;
  key: string;
  name: string;
  baseEnvironmentId?: string | null;
  previewSite?: PreviewSiteRef | null;
};

type PreviewSiteRef = {
  id: string;
  name: string;
  primaryDomain: string;
  status: string;
};

type PreviewWebhookDisposition = {
  allowed: boolean;
  action: 'deploy' | 'archive' | 'ignore';
  reason?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

@Injectable()
export class ProjectWebhookService {
  private readonly encryptionKey: Buffer;
  private readonly replayWindowSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly deploymentService: DeploymentService,
    configService: ConfigService,
  ) {
    const key = configService.get('ENCRYPTION_KEY', 'default-32-char-encryption-key!');
    this.encryptionKey = scryptSync(key, 'webhook-secret', 32);
    this.replayWindowSeconds = this.normalizeReplayWindowSeconds(
      configService.get('WEBHOOK_REPLAY_WINDOW_SECONDS', 300),
    );
  }

  async listWebhooks(teamId: string, query: ListProjectWebhooksQueryDto) {
    const where: Prisma.ProjectWebhookWhereInput = { teamId };
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    return this.prisma.projectWebhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: this.webhookSelect(),
    });
  }

  async resolveWebhookCreateAccessScope(teamId: string, dto: CreateProjectWebhookDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, teamId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return {
      projectId: project.id,
      environmentId: await this.resolveEnvironmentId(teamId, project.id, dto.environmentId),
    };
  }

  async getWebhookAccessScope(teamId: string, webhookId: string) {
    const webhook = await this.getWebhook(teamId, webhookId);
    return {
      projectId: webhook.projectId,
      environmentId: webhook.environmentId,
    };
  }

  async resolveWebhookUpdateAccessScope(
    teamId: string,
    webhookId: string,
    dto: UpdateProjectWebhookDto,
  ) {
    const webhook = await this.getWebhook(teamId, webhookId);
    if (dto.environmentId === undefined) {
      return {
        projectId: webhook.projectId,
        environmentId: webhook.environmentId,
      };
    }

    return {
      projectId: webhook.projectId,
      environmentId: await this.resolveEnvironmentId(teamId, webhook.projectId, dto.environmentId),
    };
  }

  async createWebhook(
    teamId: string,
    userId: string,
    dto: CreateProjectWebhookDto,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, teamId },
      select: { id: true, name: true, config: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    const provider = dto.provider || 'github';
    const environmentId = await this.resolveEnvironmentId(teamId, project.id, dto.environmentId);
    const deploymentMode = this.normalizeDeploymentMode(dto.deploymentMode);
    const secret = randomBytes(24).toString('hex');
    const webhook = await this.prisma.projectWebhook.create({
      data: {
        teamId,
        projectId: project.id,
        environmentId,
        createdById: userId,
        name: dto.name || `${project.name} ${provider} push`,
        provider,
        urlToken: randomBytes(24).toString('hex'),
        secret: this.encodeSecret(secret),
        enabled: true,
        eventTypes: this.toJsonValue(dto.eventTypes && dto.eventTypes.length > 0 ? dto.eventTypes : ['push']),
        branchPattern: dto.branchPattern || this.readProjectBranch(project.config) || 'main',
        tagPattern: dto.tagPattern,
        deploymentMode,
        maxAttempts: this.normalizeMaxAttempts(dto.maxAttempts),
      },
      select: this.webhookSelect(),
    });

    return {
      ...webhook,
      setupSecret: secret,
    };
  }

  async updateWebhook(
    teamId: string,
    webhookId: string,
    dto: UpdateProjectWebhookDto,
  ) {
    const existing = await this.getWebhook(teamId, webhookId);
    const environmentId = dto.environmentId !== undefined
      ? await this.resolveEnvironmentId(teamId, existing.projectId, dto.environmentId)
      : undefined;

    return this.prisma.projectWebhook.update({
      where: { id: webhookId },
      data: {
        name: dto.name,
        enabled: dto.enabled,
        environmentId,
        eventTypes: dto.eventTypes ? this.toJsonValue(dto.eventTypes) : undefined,
        branchPattern: dto.branchPattern,
        tagPattern: dto.tagPattern,
        deploymentMode: dto.deploymentMode !== undefined
          ? this.normalizeDeploymentMode(dto.deploymentMode)
          : undefined,
        maxAttempts: dto.maxAttempts !== undefined ? this.normalizeMaxAttempts(dto.maxAttempts) : undefined,
      },
      select: this.webhookSelect(),
    });
  }

  async rotateWebhookSecret(teamId: string, webhookId: string) {
    await this.getWebhook(teamId, webhookId);
    const secret = randomBytes(24).toString('hex');
    const webhook = await this.prisma.projectWebhook.update({
      where: { id: webhookId },
      data: { secret: this.encodeSecret(secret, true) },
      select: this.webhookSelect(),
    });

    return {
      ...webhook,
      setupSecret: secret,
    };
  }

  async listDeliveries(teamId: string, query: ListWebhookDeliveriesQueryDto) {
    const where: Prisma.WebhookDeliveryWhereInput = { teamId };
    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.webhookId) {
      where.webhookId = query.webhookId;
    }

    return this.prisma.webhookDelivery.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: 30,
      include: {
        webhook: { select: { id: true, name: true, provider: true, environmentId: true } },
        deploymentRun: { select: { id: true, status: true, dryRun: true, environmentId: true } },
      },
    });
  }

  async receiveGitWebhook(
    token: string,
    payload: unknown,
    headers: HeaderBag,
    sourceIp?: string,
    rawBody?: Buffer,
  ) {
    const webhook = await this.prisma.projectWebhook.findUnique({
      where: { urlToken: token },
      include: {
        project: { select: { id: true, name: true, config: true } },
      },
    });

    if (!webhook || !webhook.enabled) {
      throw new NotFoundException('Webhook 不存在');
    }

    const eventType = this.detectEventType(headers, payload);
    const signatureStatus = this.validateSignature(headers, webhook.secret, rawBody);
    const payloadHash = this.hashPayload(payload, rawBody);
    const providerEventId = this.detectProviderEventId(headers);
    const previewContext = this.extractPreviewContext(eventType, payload);
    const branch = previewContext.sourceBranch || this.extractBranch(payload);
    const commitSha = previewContext.headSha || this.extractCommitSha(payload);
    const idempotencyKey = this.buildIdempotencyKey({
      providerEventId,
      payloadHash,
      eventType,
      branch,
      commitSha,
    });
    const replayValidation = this.validateReplayWindow(headers, webhook.provider);

    if (signatureStatus === 'invalid') {
      const existingDelivery = await this.findExistingDelivery(webhook.id, idempotencyKey);
      if (existingDelivery) {
        await this.touchWebhook(webhook.id);
        return { accepted: false, duplicate: true, delivery: existingDelivery };
      }

      await this.createDelivery(webhook, {
        eventType,
        providerEventId,
        idempotencyKey,
        sourceIp,
        signatureStatus,
        payloadHash,
        payload,
        status: 'failed',
        message: 'Webhook secret 校验失败',
      });
      throw new UnauthorizedException('Webhook secret 校验失败');
    }

    if (replayValidation.status !== 'valid' && replayValidation.status !== 'not_required') {
      const existingDelivery = await this.findExistingDelivery(webhook.id, idempotencyKey);
      if (existingDelivery) {
        await this.touchWebhook(webhook.id);
        return { accepted: false, duplicate: true, delivery: existingDelivery };
      }

      const message = replayValidation.message || 'Webhook timestamp 校验失败';
      await this.createDelivery(webhook, {
        eventType,
        providerEventId,
        idempotencyKey,
        sourceIp,
        signatureStatus,
        payloadHash,
        payload,
        status: 'failed',
        message,
      });
      throw new UnauthorizedException(message);
    }

    const eventAllowed = this.isEventAllowed(webhook.eventTypes, eventType);
    const branchAllowed = this.isBranchAllowed(webhook.branchPattern, branch);
    const previewDisposition = this.resolvePreviewWebhookDisposition(webhook.deploymentMode, previewContext);
    const existingDelivery = await this.findExistingDelivery(webhook.id, idempotencyKey);
    if (existingDelivery) {
      await this.touchWebhook(webhook.id);
      return {
        accepted: existingDelivery.status === 'accepted',
        duplicate: true,
        delivery: existingDelivery,
        deploymentRun: existingDelivery.deploymentRun,
      };
    }

    if (!eventAllowed || !branchAllowed || !previewDisposition.allowed) {
      const delivery = await this.createDelivery(webhook, {
        eventType,
        providerEventId,
        idempotencyKey,
        sourceIp,
        signatureStatus,
        payloadHash,
        payload,
        status: 'ignored',
        message: !eventAllowed
          ? `事件 ${eventType} 未启用`
          : !branchAllowed
            ? `分支 ${branch || 'unknown'} 不匹配 ${webhook.branchPattern}`
            : previewDisposition.reason,
      });
      await this.touchWebhook(webhook.id);
      return { accepted: false, delivery };
    }

    const delivery = await this.createDelivery(webhook, {
      eventType,
      providerEventId,
      idempotencyKey,
      sourceIp,
      signatureStatus,
      payloadHash,
      payload,
      status: 'received',
      message: this.webhookReceivedMessage(webhook.deploymentMode, previewDisposition.action),
    });

    try {
      const liveRequest = webhook.deploymentMode === 'live_request';
      const previewRequest = webhook.deploymentMode === 'preview';
      const queue = webhook.deploymentMode === 'queue' || liveRequest || previewRequest;
      if (previewRequest && previewDisposition.action === 'archive') {
        const archivedEnvironment = await this.archivePreviewEnvironment(webhook, eventType, previewContext);
        const acceptedDelivery = await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: archivedEnvironment ? 'accepted' : 'ignored',
            message: this.webhookAcceptedMessage(
              webhook.deploymentMode,
              previewDisposition.action,
              Boolean(archivedEnvironment),
            ),
          },
          include: {
            webhook: { select: { id: true, name: true, provider: true, environmentId: true } },
            deploymentRun: { select: { id: true, status: true, dryRun: true, environmentId: true } },
          },
        });

        await this.touchWebhook(webhook.id);
        return {
          accepted: Boolean(archivedEnvironment),
          delivery: acceptedDelivery,
          previewEnvironment: archivedEnvironment,
        };
      }

      const previewEnvironment = previewRequest
        ? await this.ensurePreviewEnvironment(webhook, eventType, previewContext)
        : undefined;
      const run = await this.deploymentService.createRun(
        webhook.teamId,
        undefined,
        webhook.projectId,
        {
          dryRun: !liveRequest,
          queue,
          maxAttempts: webhook.maxAttempts,
          environmentId: previewEnvironment?.id || webhook.environmentId || undefined,
          source: 'webhook',
          trigger: previewRequest ? 'git_pr_preview' : eventType === 'push' ? 'git_push' : eventType,
          branch,
          commitSha,
          overrides: previewRequest
            ? this.buildPreviewDeploymentOverrides(
                webhook.provider,
                eventType,
                previewContext,
                previewEnvironment,
              )
            : undefined,
          approvalReason: liveRequest
            ? `Git ${eventType} 触发 live 部署申请`
            : undefined,
        },
      );

      const acceptedDelivery = await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'accepted',
          deploymentRunId: run.id,
          message: this.webhookAcceptedMessage(webhook.deploymentMode),
        },
        include: {
          webhook: { select: { id: true, name: true, provider: true, environmentId: true } },
          deploymentRun: { select: { id: true, status: true, dryRun: true, environmentId: true } },
        },
      });

      await this.touchWebhook(webhook.id);
      return { accepted: true, delivery: acceptedDelivery, deploymentRun: run };
    } catch (error) {
      const failedDelivery = await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          message: error instanceof Error ? error.message : 'Webhook 处理失败',
        },
        include: {
          webhook: { select: { id: true, name: true, provider: true, environmentId: true } },
          deploymentRun: { select: { id: true, status: true, dryRun: true, environmentId: true } },
        },
      });
      await this.touchWebhook(webhook.id);
      return { accepted: false, delivery: failedDelivery };
    }
  }

  private async getWebhook(teamId: string, webhookId: string) {
    const webhook = await this.prisma.projectWebhook.findFirst({
      where: { id: webhookId, teamId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook 不存在');
    }

    return webhook;
  }

  private webhookSelect() {
    return {
      id: true,
      teamId: true,
      projectId: true,
      name: true,
      provider: true,
      urlToken: true,
      enabled: true,
      eventTypes: true,
      branchPattern: true,
      tagPattern: true,
      deploymentMode: true,
      maxAttempts: true,
      lastDeliveryAt: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { id: true, name: true } },
      environment: { select: { id: true, key: true, name: true, status: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    };
  }

  private async createDelivery(
    webhook: {
      id: string;
      teamId: string;
      projectId: string;
    },
    input: {
      eventType: string;
      providerEventId?: string;
      idempotencyKey?: string;
      sourceIp?: string;
      signatureStatus: string;
      payloadHash: string;
      payload: unknown;
      status: string;
      message?: string;
    },
  ) {
    return this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        teamId: webhook.teamId,
        projectId: webhook.projectId,
        eventType: input.eventType,
        providerEventId: input.providerEventId,
        idempotencyKey: input.idempotencyKey,
        sourceIp: input.sourceIp,
        signatureStatus: input.signatureStatus,
        payloadHash: input.payloadHash,
        payload: this.toJsonValue(input.payload || {}),
        status: input.status,
        message: input.message,
      },
      include: {
        webhook: { select: { id: true, name: true, provider: true, environmentId: true } },
        deploymentRun: { select: { id: true, status: true, dryRun: true, environmentId: true } },
      },
    });
  }

  private touchWebhook(webhookId: string) {
    return this.prisma.projectWebhook.update({
      where: { id: webhookId },
      data: { lastDeliveryAt: new Date() },
    });
  }

  private detectEventType(headers: HeaderBag, payload: unknown) {
    const githubEvent = this.readHeader(headers, 'x-github-event');
    if (githubEvent) return this.normalizeGitEventType(githubEvent);

    const gitlabEvent = this.readHeader(headers, 'x-gitlab-event');
    if (gitlabEvent) return this.normalizeGitEventType(gitlabEvent);

    const giteeEvent = this.readHeader(headers, 'x-gitee-event');
    if (giteeEvent) return this.normalizeGitEventType(giteeEvent);

    if (isRecord(payload)) {
      return this.normalizeGitEventType(
        readString(payload.event_name) || readString(payload.object_kind) || 'push',
      );
    }

    return 'push';
  }

  private normalizeGitEventType(value: string) {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
    if (normalized.includes('push')) return 'push';
    if (normalized.includes('merge_request')) return 'merge_request';
    if (normalized.includes('pull_request') || normalized === 'pr') return 'pull_request';
    return normalized;
  }

  private detectProviderEventId(headers: HeaderBag) {
    return (
      this.readHeader(headers, 'x-github-delivery') ||
      this.readHeader(headers, 'x-gitlab-event-uuid') ||
      this.readHeader(headers, 'x-gitee-delivery')
    );
  }

  private validateSignature(headers: HeaderBag, storedSecret: string, rawBody?: Buffer) {
    const parsedSecret = this.decodeSecret(storedSecret);
    const directSecret = this.readHeader(headers, 'x-devpilot-webhook-secret');
    if (directSecret) {
      return this.hashSecret(directSecret) === parsedSecret.hash ? 'valid' : 'invalid';
    }

    const gitlabToken = this.readHeader(headers, 'x-gitlab-token');
    if (gitlabToken) {
      return this.hashSecret(gitlabToken) === parsedSecret.hash ? 'valid' : 'invalid';
    }

    const giteeToken = this.readHeader(headers, 'x-gitee-token');
    if (giteeToken) {
      return this.hashSecret(giteeToken) === parsedSecret.hash ? 'valid' : 'invalid';
    }

    const githubSignature = this.readHeader(headers, 'x-hub-signature-256');
    if (githubSignature) {
      if (!parsedSecret.secret || !rawBody) {
        return 'invalid';
      }

      const expected = `sha256=${createHmac('sha256', parsedSecret.secret)
        .update(rawBody)
        .digest('hex')}`;

      return this.safeEqual(githubSignature, expected) ? 'valid' : 'invalid';
    }

    return 'missing';
  }

  private hashPayload(payload: unknown, rawBody?: Buffer) {
    return createHash('sha256')
      .update(rawBody || JSON.stringify(payload || {}))
      .digest('hex');
  }

  private hashSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private encodeSecret(secret: string, rotated = false) {
    const now = new Date().toISOString();
    const record: StoredWebhookSecret = {
      version: 1,
      hash: this.hashSecret(secret),
      encryptedSecret: this.encrypt(secret),
      createdAt: now,
      rotatedAt: rotated ? now : undefined,
    };

    return JSON.stringify(record);
  }

  private decodeSecret(storedSecret: string): { hash: string; secret?: string } {
    try {
      const parsed = JSON.parse(storedSecret) as Partial<StoredWebhookSecret>;
      if (parsed.version === 1 && parsed.hash && parsed.encryptedSecret) {
        return {
          hash: parsed.hash,
          secret: this.decrypt(parsed.encryptedSecret),
        };
      }
    } catch {
      // Backward compatible with the first hash-only storage shape.
    }

    return { hash: storedSecret };
  }

  private encrypt(text: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string) {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private isEventAllowed(eventTypes: Prisma.JsonValue | null, eventType: string) {
    const values = readStringArray(eventTypes);
    return values.length === 0 || values.includes(eventType);
  }

  private isBranchAllowed(pattern: string | null, branch?: string) {
    if (!pattern) return true;
    if (!branch) return false;
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return branch.startsWith(pattern.slice(0, -1));
    }
    return branch === pattern;
  }

  private extractBranch(payload: unknown) {
    if (!isRecord(payload)) return undefined;
    const ref = readString(payload.ref);
    if (ref?.startsWith('refs/heads/')) {
      return ref.replace('refs/heads/', '');
    }
    return readString(payload.branch);
  }

  private extractCommitSha(payload: unknown) {
    if (!isRecord(payload)) return undefined;
    const headCommit = isRecord(payload.head_commit) ? payload.head_commit : undefined;
    return (
      readString(payload.after) ||
      readString(payload.checkout_sha) ||
      readString(headCommit?.id)
    );
  }

  private extractPreviewContext(eventType: string, payload: unknown): PreviewWebhookContext {
    if (!isRecord(payload)) {
      return { isPreviewEvent: false };
    }

    if (eventType === 'pull_request') {
      const pullRequest = isRecord(payload.pull_request) ? payload.pull_request : {};
      const head = isRecord(pullRequest.head) ? pullRequest.head : {};
      const base = isRecord(pullRequest.base) ? pullRequest.base : {};
      return {
        isPreviewEvent: true,
        action: readString(payload.action),
        pullRequestNumber: readNumber(payload.number) ?? readNumber(pullRequest.number),
        state: readString(pullRequest.state),
        merged: readBoolean(pullRequest.merged),
        title: readString(pullRequest.title),
        url: readString(pullRequest.html_url) ?? readString(pullRequest.url),
        sourceBranch: readString(head.ref),
        targetBranch: readString(base.ref),
        headSha: readString(head.sha),
      };
    }

    if (eventType === 'merge_request') {
      const attributes = isRecord(payload.object_attributes) ? payload.object_attributes : {};
      const lastCommit = isRecord(payload.last_commit)
        ? payload.last_commit
        : isRecord(attributes.last_commit)
          ? attributes.last_commit
          : {};
      return {
        isPreviewEvent: true,
        action: readString(attributes.action) ?? readString(payload.action),
        state: readString(attributes.state),
        merged: this.gitlabMergeRequestMerged(attributes),
        pullRequestNumber: readNumber(attributes.iid) ?? readNumber(attributes.id),
        title: readString(attributes.title),
        url: readString(attributes.url),
        sourceBranch: readString(attributes.source_branch),
        targetBranch: readString(attributes.target_branch),
        headSha: readString(lastCommit.id) ?? readString(payload.checkout_sha),
      };
    }

    return { isPreviewEvent: false };
  }

  private resolvePreviewWebhookDisposition(
    mode: string,
    context: PreviewWebhookContext,
  ): PreviewWebhookDisposition {
    if (mode !== 'preview') {
      return { allowed: true, action: 'deploy' };
    }

    if (!context.isPreviewEvent) {
      return {
        allowed: false,
        action: 'ignore',
        reason: '当前 Webhook 仅处理 PR Preview 事件',
      };
    }

    const action = context.action?.toLowerCase();
    const state = context.state?.toLowerCase();
    if (this.isPreviewArchiveAction(action, state, context.merged)) {
      return { allowed: true, action: 'archive' };
    }

    if (!action) {
      return { allowed: true, action: 'deploy' };
    }

    const allowedActions = new Set([
      'open',
      'opened',
      'reopen',
      'reopened',
      'synchronize',
      'synchronized',
      'sync',
      'update',
      'updated',
    ]);

    return allowedActions.has(action)
      ? { allowed: true, action: 'deploy' }
      : {
          allowed: false,
          action: 'ignore',
          reason: `PR action ${action} 暂不触发 Preview 部署`,
        };
  }

  private gitlabMergeRequestMerged(attributes: Record<string, unknown>) {
    const action = readString(attributes.action)?.toLowerCase();
    const state = readString(attributes.state)?.toLowerCase();
    return action === 'merge' || action === 'merged' || state === 'merged' ? true : undefined;
  }

  private isPreviewArchiveAction(action?: string, state?: string, merged?: boolean) {
    if (merged) return true;

    const archiveActions = new Set(['close', 'closed', 'merge', 'merged']);
    if (action && archiveActions.has(action)) return true;

    const archiveStates = new Set(['closed', 'merged']);
    return Boolean(state && archiveStates.has(state));
  }

  private async resolveEnvironmentId(teamId: string, projectId: string, environmentId?: string) {
    if (environmentId === undefined) {
      return undefined;
    }

    const trimmed = environmentId.trim();
    if (!trimmed) {
      return null;
    }

    const environment = await this.prisma.projectEnvironment.findFirst({
      where: {
        id: trimmed,
        teamId,
        projectId,
        status: 'active',
      },
      select: { id: true },
    });

    if (!environment) {
      throw new BadRequestException('Webhook 目标环境不存在或不属于当前项目');
    }

    return environment.id;
  }

  private normalizeMaxAttempts(value?: number) {
    if (!value || Number.isNaN(value)) {
      return 1;
    }

    return Math.max(1, Math.min(Math.floor(value), 5));
  }

  private normalizeReplayWindowSeconds(value: unknown) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 300;
    }

    return Math.max(60, Math.min(Math.floor(parsed), 3600));
  }

  private normalizeDeploymentMode(value?: string | null) {
    if (value === 'queue' || value === 'live_request' || value === 'preview') {
      return value;
    }

    return 'dry_run';
  }

  private webhookReceivedMessage(mode: string, previewAction: PreviewWebhookDisposition['action'] = 'deploy') {
    if (mode === 'preview') {
      if (previewAction === 'archive') {
        return 'Webhook 已接收，准备归档 PR Preview 环境';
      }
      return 'Webhook 已接收，准备生成 PR Preview 部署计划';
    }
    if (mode === 'live_request') {
      return 'Webhook 已接收，准备申请 live 部署审批';
    }
    if (mode === 'queue') {
      return 'Webhook 已接收，准备加入部署队列';
    }

    return 'Webhook 已接收，准备生成部署 dry-run';
  }

  private webhookAcceptedMessage(
    mode: string,
    previewAction: PreviewWebhookDisposition['action'] = 'deploy',
    previewEnvironmentFound = true,
  ) {
    if (mode === 'preview') {
      if (previewAction === 'archive') {
        return previewEnvironmentFound
          ? '已归档 PR Preview 环境'
          : '未找到可归档的 PR Preview 环境';
      }
      return '已创建 PR Preview 部署运行';
    }
    if (mode === 'live_request') {
      return '已创建 live 部署审批申请';
    }
    if (mode === 'queue') {
      return '已创建 queued 部署运行';
    }

    return '已生成部署 dry-run 执行计划';
  }

  private buildPreviewDeploymentOverrides(
    provider: string,
    eventType: string,
    context: PreviewWebhookContext,
    environment?: PreviewEnvironmentRef,
  ): Record<string, unknown> {
    const preview: Record<string, unknown> = {
      enabled: true,
      provider,
      eventType,
    };

    if (context.action) preview.action = context.action;
    if (context.pullRequestNumber !== undefined) preview.pullRequestNumber = context.pullRequestNumber;
    if (context.title) preview.title = context.title;
    if (context.url) preview.url = context.url;
    if (context.sourceBranch) preview.sourceBranch = context.sourceBranch;
    if (context.targetBranch) preview.targetBranch = context.targetBranch;
    if (context.headSha) preview.headSha = context.headSha;

    if (environment) {
      preview.environmentId = environment.id;
      preview.environmentKey = environment.key;
      preview.environmentName = environment.name;
      preview.baseEnvironmentId = environment.baseEnvironmentId ?? null;
      if (environment.previewSite) {
        preview.siteId = environment.previewSite.id;
        preview.siteName = environment.previewSite.name;
        preview.siteDomain = environment.previewSite.primaryDomain;
        preview.siteStatus = environment.previewSite.status;
      }
    }

    return { preview };
  }

  private async archivePreviewEnvironment(
    webhook: {
      id: string;
      teamId: string;
      projectId: string;
      environmentId?: string | null;
      createdById?: string | null;
      provider: string;
    },
    eventType: string,
    context: PreviewWebhookContext,
  ): Promise<PreviewEnvironmentRef | null> {
    const key = this.previewEnvironmentKey(eventType, context);
    const existing = await this.prisma.projectEnvironment.findUnique({
      where: {
        projectId_key: {
          projectId: webhook.projectId,
          key,
        },
      },
      select: {
        id: true,
        key: true,
        name: true,
        config: true,
      },
    });

    if (!existing) {
      return null;
    }

    const config = this.buildArchivedPreviewEnvironmentConfig(existing.config, {
      webhookId: webhook.id,
      provider: webhook.provider,
      eventType,
      context,
      baseEnvironmentId: webhook.environmentId ?? null,
      key,
    });
    const environment = await this.prisma.projectEnvironment.update({
      where: { id: existing.id },
      data: {
        status: 'archived',
        description: this.previewEnvironmentArchiveDescription(context),
        config: this.toJsonValue(config),
      },
      select: { id: true, key: true, name: true },
    });
    const archivedSite = await this.archivePreviewSite(webhook, eventType, context, environment.id);

    return {
      ...environment,
      baseEnvironmentId: webhook.environmentId ?? null,
      previewSite: archivedSite,
    };
  }

  private async ensurePreviewEnvironment(
    webhook: {
      id: string;
      teamId: string;
      projectId: string;
      environmentId?: string | null;
      createdById?: string | null;
      provider: string;
    },
    eventType: string,
    context: PreviewWebhookContext,
  ): Promise<PreviewEnvironmentRef> {
    const key = this.previewEnvironmentKey(eventType, context);
    const name = this.previewEnvironmentName(eventType, context);
    const description = this.previewEnvironmentDescription(context);
    const existing = await this.prisma.projectEnvironment.findUnique({
      where: {
        projectId_key: {
          projectId: webhook.projectId,
          key,
        },
      },
      select: {
        id: true,
        key: true,
        name: true,
        config: true,
      },
    });
    const config = this.buildPreviewEnvironmentConfig(existing?.config, {
      webhookId: webhook.id,
      provider: webhook.provider,
      eventType,
      context,
      baseEnvironmentId: webhook.environmentId ?? null,
      key,
    });

    const data = {
      name,
      description,
      status: 'active',
      sortOrder: this.previewEnvironmentSortOrder(context),
      config: this.toJsonValue(config),
    };

    const environment = existing
      ? await this.prisma.projectEnvironment.update({
          where: { id: existing.id },
          data,
          select: { id: true, key: true, name: true },
        })
      : await this.prisma.projectEnvironment.create({
          data: {
            teamId: webhook.teamId,
            projectId: webhook.projectId,
            key,
            ...data,
          },
          select: { id: true, key: true, name: true },
        });
    const previewSite = await this.ensurePreviewSite(webhook, eventType, context, environment);

    if (previewSite) {
      const nextConfig = this.attachPreviewSiteToEnvironmentConfig(config, previewSite);
      await this.prisma.projectEnvironment.update({
        where: { id: environment.id },
        data: { config: this.toJsonValue(nextConfig) },
      });
    }

    return {
      ...environment,
      baseEnvironmentId: webhook.environmentId ?? null,
      previewSite,
    };
  }

  private async ensurePreviewSite(
    webhook: {
      id: string;
      teamId: string;
      projectId: string;
      createdById?: string | null;
      provider: string;
    },
    eventType: string,
    context: PreviewWebhookContext,
    environment: { id: string; key: string; name: string },
  ): Promise<PreviewSiteRef | null> {
    if (!webhook.createdById) {
      return null;
    }

    const primaryDomain = this.previewSiteDomain(eventType, context);
    const runtimeConfig = this.buildPreviewSiteRuntimeConfig(undefined, {
      webhookId: webhook.id,
      provider: webhook.provider,
      eventType,
      context,
      environment,
      primaryDomain,
    });
    const existing = await this.prisma.site.findFirst({
      where: {
        teamId: webhook.teamId,
        projectId: webhook.projectId,
        environmentId: environment.id,
        primaryDomain,
      },
      select: {
        id: true,
        name: true,
        primaryDomain: true,
        status: true,
        runtimeConfig: true,
      },
    });

    if (existing) {
      const site = await this.prisma.site.update({
        where: { id: existing.id },
        data: {
          name: this.previewSiteName(context),
          status: 'draft',
          runtimeType: 'reverse_proxy',
          runtimeConfig: this.toJsonValue(this.buildPreviewSiteRuntimeConfig(existing.runtimeConfig, {
            webhookId: webhook.id,
            provider: webhook.provider,
            eventType,
            context,
            environment,
            primaryDomain,
          })),
          tls: this.toJsonValue(this.previewSiteTlsConfig()),
          accessPolicy: this.toJsonValue(this.previewSiteAccessPolicy()),
        },
        select: { id: true, name: true, primaryDomain: true, status: true },
      });

      return site;
    }

    const site = await this.prisma.site.create({
      data: {
        teamId: webhook.teamId,
        createdById: webhook.createdById,
        projectId: webhook.projectId,
        environmentId: environment.id,
        name: this.previewSiteName(context),
        primaryDomain,
        runtimeType: 'reverse_proxy',
        runtimeConfig: this.toJsonValue(runtimeConfig),
        tls: this.toJsonValue(this.previewSiteTlsConfig()),
        accessPolicy: this.toJsonValue(this.previewSiteAccessPolicy()),
        status: 'draft',
      },
      select: { id: true, name: true, primaryDomain: true, status: true },
    });

    return site;
  }

  private async archivePreviewSite(
    webhook: {
      teamId: string;
      projectId: string;
      provider: string;
    },
    eventType: string,
    context: PreviewWebhookContext,
    environmentId: string,
  ): Promise<PreviewSiteRef | null> {
    const primaryDomain = this.previewSiteDomain(eventType, context);
    const existing = await this.prisma.site.findFirst({
      where: {
        teamId: webhook.teamId,
        projectId: webhook.projectId,
        environmentId,
        primaryDomain,
      },
      select: {
        id: true,
        name: true,
        primaryDomain: true,
        status: true,
        runtimeConfig: true,
      },
    });

    if (!existing) {
      return null;
    }

    const site = await this.prisma.site.update({
      where: { id: existing.id },
      data: {
        status: 'draft',
        runtimeConfig: this.toJsonValue(this.buildArchivedPreviewSiteRuntimeConfig(existing.runtimeConfig, {
          provider: webhook.provider,
          eventType,
          context,
          primaryDomain,
        })),
      },
      select: { id: true, name: true, primaryDomain: true, status: true },
    });

    return site;
  }

  private buildArchivedPreviewEnvironmentConfig(
    existingConfig: unknown,
    input: {
      webhookId: string;
      provider: string;
      eventType: string;
      context: PreviewWebhookContext;
      baseEnvironmentId: string | null;
      key: string;
    },
  ): Record<string, unknown> {
    const now = new Date().toISOString();
    const config = isRecord(existingConfig) ? { ...existingConfig } : {};
    const previousPreview = isRecord(config.preview) ? config.preview : {};
    const archiveReason = input.context.merged ? 'merged' : 'closed';
    const preview: Record<string, unknown> = {
      ...previousPreview,
      enabled: false,
      lifecycle: 'temporary',
      status: 'archived',
      archiveReason,
      provider: input.provider,
      eventType: input.eventType,
      environmentKey: input.key,
      baseEnvironmentId: input.baseEnvironmentId,
      webhookId: input.webhookId,
      archivedAt: now,
      lastSeenAt: now,
      teardown: {
        status: 'not_started',
        reason: 'archive_only_no_live_teardown_executor',
      },
    };

    if (input.context.action) preview.action = input.context.action;
    if (input.context.state) preview.state = input.context.state;
    if (input.context.merged !== undefined) preview.merged = input.context.merged;
    if (input.context.pullRequestNumber !== undefined) {
      preview.pullRequestNumber = input.context.pullRequestNumber;
    }
    if (input.context.title) preview.title = input.context.title;
    if (input.context.url) preview.url = input.context.url;
    if (input.context.sourceBranch) preview.sourceBranch = input.context.sourceBranch;
    if (input.context.targetBranch) preview.targetBranch = input.context.targetBranch;
    if (input.context.headSha) preview.headSha = input.context.headSha;

    return {
      ...config,
      source: 'project_webhook_preview',
      lifecycle: 'preview',
      preview,
    };
  }

  private attachPreviewSiteToEnvironmentConfig(
    environmentConfig: Record<string, unknown>,
    site: PreviewSiteRef,
  ) {
    const config = { ...environmentConfig };
    const preview = isRecord(config.preview) ? { ...config.preview } : {};
    preview.site = {
      id: site.id,
      name: site.name,
      primaryDomain: site.primaryDomain,
      status: site.status,
      kind: 'draft_site_placeholder',
      syncBlocked: true,
      lastProvisionedAt: new Date().toISOString(),
    };

    return {
      ...config,
      preview,
    };
  }

  private buildPreviewSiteRuntimeConfig(
    existingConfig: unknown,
    input: {
      webhookId: string;
      provider: string;
      eventType: string;
      context: PreviewWebhookContext;
      environment: { id: string; key: string; name: string };
      primaryDomain: string;
    },
  ) {
    const config = isRecord(existingConfig) ? { ...existingConfig } : {};
    const previousPreview = isRecord(config.preview) ? config.preview : {};
    const preview: Record<string, unknown> = {
      ...previousPreview,
      enabled: true,
      status: 'draft',
      kind: 'draft_site_placeholder',
      provider: input.provider,
      eventType: input.eventType,
      webhookId: input.webhookId,
      environmentId: input.environment.id,
      environmentKey: input.environment.key,
      primaryDomain: input.primaryDomain,
      syncBlocked: true,
      syncBlockedReason: 'preview_site_placeholder_requires_runtime_and_domain_confirmation',
      lastSeenAt: new Date().toISOString(),
    };

    if (input.context.action) preview.action = input.context.action;
    if (input.context.pullRequestNumber !== undefined) {
      preview.pullRequestNumber = input.context.pullRequestNumber;
    }
    if (input.context.title) preview.title = input.context.title;
    if (input.context.url) preview.url = input.context.url;
    if (input.context.sourceBranch) preview.sourceBranch = input.context.sourceBranch;
    if (input.context.targetBranch) preview.targetBranch = input.context.targetBranch;
    if (input.context.headSha) preview.headSha = input.context.headSha;

    return {
      ...config,
      placeholder: true,
      syncBlocked: true,
      preview,
    };
  }

  private buildArchivedPreviewSiteRuntimeConfig(
    existingConfig: unknown,
    input: {
      provider: string;
      eventType: string;
      context: PreviewWebhookContext;
      primaryDomain: string;
    },
  ) {
    const config = isRecord(existingConfig) ? { ...existingConfig } : {};
    const previousPreview = isRecord(config.preview) ? config.preview : {};
    const archiveReason = input.context.merged ? 'merged' : 'closed';
    const preview: Record<string, unknown> = {
      ...previousPreview,
      enabled: false,
      status: 'archived',
      archiveReason,
      kind: 'draft_site_placeholder',
      provider: input.provider,
      eventType: input.eventType,
      primaryDomain: input.primaryDomain,
      syncBlocked: true,
      syncBlockedReason: 'preview_site_archived',
      archivedAt: new Date().toISOString(),
    };

    if (input.context.action) preview.action = input.context.action;
    if (input.context.state) preview.state = input.context.state;
    if (input.context.merged !== undefined) preview.merged = input.context.merged;
    if (input.context.pullRequestNumber !== undefined) {
      preview.pullRequestNumber = input.context.pullRequestNumber;
    }
    if (input.context.title) preview.title = input.context.title;
    if (input.context.url) preview.url = input.context.url;
    if (input.context.sourceBranch) preview.sourceBranch = input.context.sourceBranch;
    if (input.context.targetBranch) preview.targetBranch = input.context.targetBranch;
    if (input.context.headSha) preview.headSha = input.context.headSha;

    return {
      ...config,
      placeholder: true,
      syncBlocked: true,
      preview,
    };
  }

  private buildPreviewEnvironmentConfig(
    existingConfig: unknown,
    input: {
      webhookId: string;
      provider: string;
      eventType: string;
      context: PreviewWebhookContext;
      baseEnvironmentId: string | null;
      key: string;
    },
  ): Record<string, unknown> {
    const now = new Date().toISOString();
    const config = isRecord(existingConfig) ? { ...existingConfig } : {};
    const previousPreview = isRecord(config.preview) ? config.preview : {};
    const preview: Record<string, unknown> = {
      ...previousPreview,
      enabled: true,
      lifecycle: 'temporary',
      status: 'active',
      provider: input.provider,
      eventType: input.eventType,
      environmentKey: input.key,
      baseEnvironmentId: input.baseEnvironmentId,
      webhookId: input.webhookId,
      initializedBy: 'ProjectWebhookService.ensurePreviewEnvironment',
      lastSeenAt: now,
    };

    if (input.context.action) preview.action = input.context.action;
    if (input.context.pullRequestNumber !== undefined) {
      preview.pullRequestNumber = input.context.pullRequestNumber;
    }
    if (input.context.title) preview.title = input.context.title;
    if (input.context.url) preview.url = input.context.url;
    if (input.context.sourceBranch) preview.sourceBranch = input.context.sourceBranch;
    if (input.context.targetBranch) preview.targetBranch = input.context.targetBranch;
    if (input.context.headSha) preview.headSha = input.context.headSha;

    return {
      ...config,
      source: 'project_webhook_preview',
      lifecycle: 'preview',
      preview,
    };
  }

  private previewEnvironmentKey(eventType: string, context: PreviewWebhookContext) {
    const number = context.pullRequestNumber;
    if (number !== undefined) {
      return eventType === 'merge_request'
        ? `preview-mr-${number}`
        : `preview-pr-${number}`;
    }

    const branchSlug = this.slugForEnvironmentKey(context.sourceBranch || context.targetBranch || 'unknown');
    const sha = context.headSha ? context.headSha.slice(0, 8).toLowerCase() : undefined;
    return ['preview', branchSlug, sha].filter(Boolean).join('-').slice(0, 80);
  }

  private previewEnvironmentName(eventType: string, context: PreviewWebhookContext) {
    if (context.pullRequestNumber !== undefined) {
      return eventType === 'merge_request'
        ? `MR !${context.pullRequestNumber} Preview`
        : `PR #${context.pullRequestNumber} Preview`;
    }

    return `Preview ${context.sourceBranch || context.headSha || 'environment'}`;
  }

  private previewSiteName(context: PreviewWebhookContext) {
    if (context.pullRequestNumber !== undefined) {
      return `Preview Site #${context.pullRequestNumber}`;
    }

    return `Preview Site ${context.sourceBranch || context.headSha || 'environment'}`;
  }

  private previewSiteDomain(eventType: string, context: PreviewWebhookContext) {
    return `${this.previewEnvironmentKey(eventType, context)}.preview.devpilot.local`;
  }

  private previewSiteTlsConfig() {
    return {
      enabled: false,
      type: 'none',
      preview: {
        status: 'placeholder',
        reason: 'preview_site_placeholder_no_tls_until_domain_confirmed',
      },
    };
  }

  private previewSiteAccessPolicy() {
    return {
      mode: 'placeholder',
      preview: {
        status: 'draft',
        syncBlocked: true,
      },
    };
  }

  private previewEnvironmentDescription(context: PreviewWebhookContext) {
    const parts = [
      context.title,
      context.sourceBranch && context.targetBranch
        ? `${context.sourceBranch} -> ${context.targetBranch}`
        : context.sourceBranch,
      context.url,
    ].filter((part): part is string => Boolean(part));

    return parts.length > 0
      ? `PR Preview environment: ${parts.join(' | ')}`
      : 'PR Preview environment managed by Devpilot webhook automation.';
  }

  private previewEnvironmentArchiveDescription(context: PreviewWebhookContext) {
    const reason = context.merged ? 'merged' : 'closed';
    const suffix = context.pullRequestNumber !== undefined
      ? `#${context.pullRequestNumber}`
      : context.sourceBranch || context.headSha || 'unknown';

    return `Archived PR Preview environment (${reason}): ${suffix}`;
  }

  private previewEnvironmentSortOrder(context: PreviewWebhookContext) {
    const number = context.pullRequestNumber ?? 0;
    return 9000 + Math.min(number, 999);
  }

  private slugForEnvironmentKey(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    return normalized || 'unknown';
  }

  private validateReplayWindow(headers: HeaderBag, provider: string) {
    const timestampHeader =
      this.readHeader(headers, 'x-devpilot-webhook-timestamp') ||
      this.readHeader(headers, 'x-svton-webhook-timestamp');
    const requiresTimestamp =
      provider === 'generic' || Boolean(this.readHeader(headers, 'x-devpilot-webhook-secret'));

    if (!timestampHeader) {
      return requiresTimestamp
        ? {
            status: 'missing' as const,
            message: 'Webhook timestamp 缺失，请传入 x-devpilot-webhook-timestamp',
          }
        : { status: 'not_required' as const };
    }

    const timestampMs = this.parseWebhookTimestamp(timestampHeader);
    if (!timestampMs) {
      return {
        status: 'invalid' as const,
        message: 'Webhook timestamp 格式无效',
      };
    }

    const skewSeconds = Math.abs(Date.now() - timestampMs) / 1000;
    if (skewSeconds > this.replayWindowSeconds) {
      return {
        status: 'expired' as const,
        message: `Webhook timestamp 超出 ${this.replayWindowSeconds} 秒时间窗`,
      };
    }

    return { status: 'valid' as const };
  }

  private parseWebhookTimestamp(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    }

    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private buildIdempotencyKey(input: {
    providerEventId?: string;
    payloadHash: string;
    eventType: string;
    branch?: string;
    commitSha?: string;
  }) {
    if (input.providerEventId) {
      return `provider:${this.hashShort(input.providerEventId)}`;
    }

    return `payload:${this.hashShort([
      input.eventType,
      input.branch || '',
      input.commitSha || '',
      input.payloadHash,
    ].join(':'))}`;
  }

  private hashShort(value: string) {
    return createHash('sha256').update(value).digest('hex').slice(0, 48);
  }

  private findExistingDelivery(webhookId: string, idempotencyKey: string) {
    return this.prisma.webhookDelivery.findFirst({
      where: { webhookId, idempotencyKey },
      include: {
        webhook: { select: { id: true, name: true, provider: true, environmentId: true } },
        deploymentRun: { select: { id: true, status: true, dryRun: true, environmentId: true } },
      },
    });
  }

  private readProjectBranch(config: unknown) {
    const record = isRecord(config) ? config : {};
    const source = isRecord(record.source) ? record.source : undefined;
    return readString(source?.branch);
  }

  private readHeader(headers: HeaderBag, key: string) {
    const value = headers[key] || headers[key.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return value;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
