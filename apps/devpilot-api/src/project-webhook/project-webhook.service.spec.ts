import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentService } from '../deployment/deployment.service';
import { ProjectWebhookService } from './project-webhook.service';

describe('ProjectWebhookService PR preview webhooks', () => {
  let prisma: {
    projectWebhook: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    webhookDelivery: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    projectEnvironment: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    site: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let deploymentService: { createRun: jest.Mock };
  let service: ProjectWebhookService;

  beforeEach(() => {
    prisma = {
      projectWebhook: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'webhook-1' }),
      },
      webhookDelivery: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      projectEnvironment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      site: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    deploymentService = { createRun: jest.fn() };
    service = new ProjectWebhookService(
      prisma as unknown as PrismaService,
      deploymentService as unknown as DeploymentService,
      { get: jest.fn((_key: string, fallback?: unknown) => fallback) } as unknown as ConfigService,
    );
  });

  it('creates a queued dry-run preview DeploymentRun from a GitHub pull_request event', async () => {
    prisma.projectWebhook.findUnique.mockResolvedValue(previewWebhook({
      eventTypes: ['pull_request'],
      branchPattern: '*',
      deploymentMode: 'preview',
      maxAttempts: 3,
    }));
    prisma.webhookDelivery.findFirst.mockResolvedValue(null);
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-1', status: 'received' });
    prisma.webhookDelivery.update.mockResolvedValue({
      id: 'delivery-1',
      status: 'accepted',
      deploymentRun: { id: 'run-preview', status: 'queued', dryRun: true },
    });
    prisma.projectEnvironment.findUnique.mockResolvedValue(null);
    prisma.projectEnvironment.create.mockResolvedValue({
      id: 'env-preview-pr-42',
      key: 'preview-pr-42',
      name: 'PR #42 Preview',
    });
    deploymentService.createRun.mockResolvedValue({ id: 'run-preview', status: 'queued', dryRun: true });

    await expect(service.receiveGitWebhook(
      'token-1',
      githubPullRequestPayload(),
      signedHeaders({ 'x-github-event': 'pull_request' }),
      '127.0.0.1',
    )).resolves.toEqual(expect.objectContaining({
      accepted: true,
      deploymentRun: expect.objectContaining({ id: 'run-preview' }),
    }));

    expect(prisma.webhookDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'pull_request',
        status: 'received',
        message: 'Webhook 已接收，准备生成 PR Preview 部署计划',
        signatureStatus: 'valid',
      }),
      include: expect.any(Object),
    });
    expect(deploymentService.createRun).toHaveBeenCalledWith('team-1', undefined, 'project-1', {
      dryRun: true,
      queue: true,
      maxAttempts: 3,
      environmentId: 'env-preview-pr-42',
      source: 'webhook',
      trigger: 'git_pr_preview',
      branch: 'feature/checkout',
      commitSha: 'abc123preview',
      overrides: {
        preview: {
          enabled: true,
          provider: 'github',
          eventType: 'pull_request',
          action: 'synchronize',
          pullRequestNumber: 42,
          title: 'Add checkout flow',
          url: 'https://github.example.test/acme/app/pull/42',
          sourceBranch: 'feature/checkout',
          targetBranch: 'main',
          headSha: 'abc123preview',
          environmentId: 'env-preview-pr-42',
          environmentKey: 'preview-pr-42',
          environmentName: 'PR #42 Preview',
          baseEnvironmentId: 'env-preview',
        },
      },
      approvalReason: undefined,
    });
    expect(prisma.projectEnvironment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: 'team-1',
        projectId: 'project-1',
        key: 'preview-pr-42',
        name: 'PR #42 Preview',
        status: 'active',
        config: expect.objectContaining({
          source: 'project_webhook_preview',
          lifecycle: 'preview',
          preview: expect.objectContaining({
            provider: 'github',
            eventType: 'pull_request',
            pullRequestNumber: 42,
            environmentKey: 'preview-pr-42',
            baseEnvironmentId: 'env-preview',
            webhookId: 'webhook-1',
          }),
        }),
      }),
      select: { id: true, key: true, name: true },
    });
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: {
        status: 'accepted',
        deploymentRunId: 'run-preview',
        message: '已创建 PR Preview 部署运行',
      },
      include: expect.any(Object),
    });
  });

  it('creates a draft Site placeholder for accepted pull_request preview events', async () => {
    prisma.projectWebhook.findUnique.mockResolvedValue(previewWebhook({
      eventTypes: ['pull_request'],
      branchPattern: '*',
      deploymentMode: 'preview',
    }));
    prisma.webhookDelivery.findFirst.mockResolvedValue(null);
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-site', status: 'received' });
    prisma.webhookDelivery.update.mockResolvedValue({
      id: 'delivery-site',
      status: 'accepted',
      deploymentRun: { id: 'run-site-preview', status: 'queued', dryRun: true },
    });
    prisma.projectEnvironment.findUnique.mockResolvedValue(null);
    prisma.projectEnvironment.create.mockResolvedValue({
      id: 'env-preview-pr-42',
      key: 'preview-pr-42',
      name: 'PR #42 Preview',
    });
    prisma.projectEnvironment.update.mockResolvedValue({
      id: 'env-preview-pr-42',
      key: 'preview-pr-42',
      name: 'PR #42 Preview',
    });
    prisma.site.findFirst.mockResolvedValue(null);
    prisma.site.create.mockResolvedValue({
      id: 'site-preview-pr-42',
      name: 'Preview Site #42',
      primaryDomain: 'preview-pr-42.preview.devpilot.local',
      status: 'draft',
    });
    deploymentService.createRun.mockResolvedValue({ id: 'run-site-preview', status: 'queued', dryRun: true });

    await service.receiveGitWebhook(
      'token-1',
      githubPullRequestPayload(),
      signedHeaders({ 'x-github-event': 'pull_request' }),
      '127.0.0.1',
    );

    expect(prisma.site.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: 'team-1',
        createdById: 'user-1',
        projectId: 'project-1',
        environmentId: 'env-preview-pr-42',
        name: 'Preview Site #42',
        primaryDomain: 'preview-pr-42.preview.devpilot.local',
        runtimeType: 'reverse_proxy',
        status: 'draft',
        runtimeConfig: expect.objectContaining({
          placeholder: true,
          syncBlocked: true,
          preview: expect.objectContaining({
            kind: 'draft_site_placeholder',
            pullRequestNumber: 42,
            primaryDomain: 'preview-pr-42.preview.devpilot.local',
            syncBlocked: true,
          }),
        }),
      }),
      select: { id: true, name: true, primaryDomain: true, status: true },
    });
    expect(prisma.projectEnvironment.update).toHaveBeenCalledWith({
      where: { id: 'env-preview-pr-42' },
      data: {
        config: expect.objectContaining({
          preview: expect.objectContaining({
            site: {
              id: 'site-preview-pr-42',
              name: 'Preview Site #42',
              primaryDomain: 'preview-pr-42.preview.devpilot.local',
              status: 'draft',
              kind: 'draft_site_placeholder',
              syncBlocked: true,
              lastProvisionedAt: expect.any(String),
            },
          }),
        }),
      },
    });
    expect(deploymentService.createRun).toHaveBeenCalledWith('team-1', undefined, 'project-1', expect.objectContaining({
      overrides: {
        preview: expect.objectContaining({
          siteId: 'site-preview-pr-42',
          siteName: 'Preview Site #42',
          siteDomain: 'preview-pr-42.preview.devpilot.local',
          siteStatus: 'draft',
        }),
      },
    }));
  });

  it('archives an existing preview environment for closed pull_request events without creating deployment runs', async () => {
    prisma.projectWebhook.findUnique.mockResolvedValue(previewWebhook({
      eventTypes: ['pull_request'],
      branchPattern: '*',
      deploymentMode: 'preview',
    }));
    prisma.webhookDelivery.findFirst.mockResolvedValue(null);
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-archive', status: 'received' });
    prisma.webhookDelivery.update.mockResolvedValue({
      id: 'delivery-archive',
      status: 'accepted',
      deploymentRun: null,
    });
    prisma.projectEnvironment.findUnique.mockResolvedValue({
      id: 'env-preview-pr-42',
      key: 'preview-pr-42',
      name: 'PR #42 Preview',
      config: {
        preview: {
          createdBy: 'previous-preview-run',
          status: 'active',
        },
      },
    });
    prisma.projectEnvironment.update.mockResolvedValue({
      id: 'env-preview-pr-42',
      key: 'preview-pr-42',
      name: 'PR #42 Preview',
    });
    prisma.site.findFirst.mockResolvedValue({
      id: 'site-preview-pr-42',
      name: 'Preview Site #42',
      primaryDomain: 'preview-pr-42.preview.devpilot.local',
      status: 'draft',
      runtimeConfig: {
        preview: {
          status: 'draft',
        },
      },
    });
    prisma.site.update.mockResolvedValue({
      id: 'site-preview-pr-42',
      name: 'Preview Site #42',
      primaryDomain: 'preview-pr-42.preview.devpilot.local',
      status: 'draft',
    });

    await expect(service.receiveGitWebhook(
      'token-1',
      githubPullRequestPayload({ action: 'closed' }),
      signedHeaders({ 'x-github-event': 'pull_request' }),
      '127.0.0.1',
    )).resolves.toEqual(expect.objectContaining({
      accepted: true,
      delivery: expect.objectContaining({ id: 'delivery-archive' }),
      previewEnvironment: expect.objectContaining({ id: 'env-preview-pr-42' }),
    }));

    expect(deploymentService.createRun).not.toHaveBeenCalled();
    expect(prisma.site.update).toHaveBeenCalledWith({
      where: { id: 'site-preview-pr-42' },
      data: expect.objectContaining({
        status: 'draft',
        runtimeConfig: expect.objectContaining({
          placeholder: true,
          syncBlocked: true,
          preview: expect.objectContaining({
            status: 'archived',
            archiveReason: 'closed',
            primaryDomain: 'preview-pr-42.preview.devpilot.local',
            syncBlocked: true,
          }),
        }),
      }),
      select: { id: true, name: true, primaryDomain: true, status: true },
    });
    expect(prisma.projectEnvironment.update).toHaveBeenCalledWith({
      where: { id: 'env-preview-pr-42' },
      data: expect.objectContaining({
        status: 'archived',
        description: 'Archived PR Preview environment (closed): #42',
        config: expect.objectContaining({
          preview: expect.objectContaining({
            createdBy: 'previous-preview-run',
            status: 'archived',
            enabled: false,
            archiveReason: 'closed',
            action: 'closed',
            pullRequestNumber: 42,
            environmentKey: 'preview-pr-42',
            webhookId: 'webhook-1',
            teardown: {
              status: 'not_started',
              reason: 'archive_only_no_live_teardown_executor',
            },
          }),
        }),
      }),
      select: { id: true, key: true, name: true },
    });
    expect(prisma.webhookDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'pull_request',
        status: 'received',
        message: 'Webhook 已接收，准备归档 PR Preview 环境',
      }),
      include: expect.any(Object),
    });
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-archive' },
      data: {
        status: 'accepted',
        message: '已归档 PR Preview 环境',
      },
      include: expect.any(Object),
    });
  });

  it('normalizes GitLab merge request events and uses the source branch as preview ref', async () => {
    prisma.projectWebhook.findUnique.mockResolvedValue(previewWebhook({
      provider: 'gitlab',
      eventTypes: ['merge_request'],
      branchPattern: 'feature/*',
      deploymentMode: 'preview',
      maxAttempts: 2,
    }));
    prisma.webhookDelivery.findFirst.mockResolvedValue(null);
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-gitlab', status: 'received' });
    prisma.webhookDelivery.update.mockResolvedValue({
      id: 'delivery-gitlab',
      status: 'accepted',
      deploymentRun: { id: 'run-gitlab-preview', status: 'queued', dryRun: true },
    });
    prisma.projectEnvironment.findUnique.mockResolvedValue(null);
    prisma.projectEnvironment.create.mockResolvedValue({
      id: 'env-preview-mr-17',
      key: 'preview-mr-17',
      name: 'MR !17 Preview',
    });
    deploymentService.createRun.mockResolvedValue({ id: 'run-gitlab-preview', status: 'queued', dryRun: true });

    await service.receiveGitWebhook(
      'token-1',
      gitlabMergeRequestPayload(),
      signedHeaders({ 'x-gitlab-event': 'Merge Request Hook' }),
      '127.0.0.1',
    );

    expect(deploymentService.createRun).toHaveBeenCalledWith('team-1', undefined, 'project-1', expect.objectContaining({
      dryRun: true,
      queue: true,
      trigger: 'git_pr_preview',
      environmentId: 'env-preview-mr-17',
      branch: 'feature/cart',
      commitSha: 'def456preview',
      overrides: {
        preview: expect.objectContaining({
          provider: 'gitlab',
          eventType: 'merge_request',
          action: 'update',
          pullRequestNumber: 17,
          sourceBranch: 'feature/cart',
          targetBranch: 'main',
          headSha: 'def456preview',
          environmentId: 'env-preview-mr-17',
          environmentKey: 'preview-mr-17',
          environmentName: 'MR !17 Preview',
          baseEnvironmentId: 'env-preview',
        }),
      },
    }));
  });

  it('reuses an existing preview environment for repeated pull_request events', async () => {
    prisma.projectWebhook.findUnique.mockResolvedValue(previewWebhook({
      eventTypes: ['pull_request'],
      branchPattern: '*',
      deploymentMode: 'preview',
    }));
    prisma.webhookDelivery.findFirst.mockResolvedValue(null);
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-repeat', status: 'received' });
    prisma.webhookDelivery.update.mockResolvedValue({
      id: 'delivery-repeat',
      status: 'accepted',
      deploymentRun: { id: 'run-repeat-preview', status: 'queued', dryRun: true },
    });
    prisma.projectEnvironment.findUnique.mockResolvedValue({
      id: 'env-preview-pr-42',
      key: 'preview-pr-42',
      name: 'Old Preview Name',
      config: {
        preview: {
          createdBy: 'previous-run',
        },
      },
    });
    prisma.projectEnvironment.update.mockResolvedValue({
      id: 'env-preview-pr-42',
      key: 'preview-pr-42',
      name: 'PR #42 Preview',
    });
    deploymentService.createRun.mockResolvedValue({ id: 'run-repeat-preview', status: 'queued', dryRun: true });

    await service.receiveGitWebhook(
      'token-1',
      githubPullRequestPayload({ action: 'synchronize' }),
      signedHeaders({ 'x-github-event': 'pull_request' }),
      '127.0.0.1',
    );

    expect(prisma.projectEnvironment.create).not.toHaveBeenCalled();
    expect(prisma.projectEnvironment.update).toHaveBeenCalledWith({
      where: { id: 'env-preview-pr-42' },
      data: expect.objectContaining({
        name: 'PR #42 Preview',
        status: 'active',
        config: expect.objectContaining({
          preview: expect.objectContaining({
            createdBy: 'previous-run',
            pullRequestNumber: 42,
            webhookId: 'webhook-1',
          }),
        }),
      }),
      select: { id: true, key: true, name: true },
    });
    expect(deploymentService.createRun).toHaveBeenCalledWith('team-1', undefined, 'project-1', expect.objectContaining({
      environmentId: 'env-preview-pr-42',
      overrides: {
        preview: expect.objectContaining({
          environmentId: 'env-preview-pr-42',
          environmentKey: 'preview-pr-42',
          environmentName: 'PR #42 Preview',
        }),
      },
    }));
  });

  it('archives an existing preview environment for merged GitLab merge request events', async () => {
    prisma.projectWebhook.findUnique.mockResolvedValue(previewWebhook({
      provider: 'gitlab',
      eventTypes: ['merge_request'],
      branchPattern: 'feature/*',
      deploymentMode: 'preview',
    }));
    prisma.webhookDelivery.findFirst.mockResolvedValue(null);
    prisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-gitlab-archive', status: 'received' });
    prisma.webhookDelivery.update.mockResolvedValue({
      id: 'delivery-gitlab-archive',
      status: 'accepted',
      deploymentRun: null,
    });
    prisma.projectEnvironment.findUnique.mockResolvedValue({
      id: 'env-preview-mr-17',
      key: 'preview-mr-17',
      name: 'MR !17 Preview',
      config: { preview: { status: 'active' } },
    });
    prisma.projectEnvironment.update.mockResolvedValue({
      id: 'env-preview-mr-17',
      key: 'preview-mr-17',
      name: 'MR !17 Preview',
    });

    await expect(service.receiveGitWebhook(
      'token-1',
      gitlabMergeRequestPayload({
        action: 'merge',
        state: 'merged',
      }),
      signedHeaders({ 'x-gitlab-event': 'Merge Request Hook' }),
      '127.0.0.1',
    )).resolves.toEqual(expect.objectContaining({
      accepted: true,
      previewEnvironment: expect.objectContaining({ id: 'env-preview-mr-17' }),
    }));

    expect(deploymentService.createRun).not.toHaveBeenCalled();
    expect(prisma.projectEnvironment.update).toHaveBeenCalledWith({
      where: { id: 'env-preview-mr-17' },
      data: expect.objectContaining({
        status: 'archived',
        description: 'Archived PR Preview environment (merged): #17',
        config: expect.objectContaining({
          preview: expect.objectContaining({
            status: 'archived',
            archiveReason: 'merged',
            action: 'merge',
            state: 'merged',
            merged: true,
            pullRequestNumber: 17,
            environmentKey: 'preview-mr-17',
          }),
        }),
      }),
      select: { id: true, key: true, name: true },
    });
  });
});

function previewWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: 'webhook-1',
    teamId: 'team-1',
    projectId: 'project-1',
    environmentId: 'env-preview',
    createdById: 'user-1',
    provider: 'github',
    secret: storedSecret('secret-1'),
    enabled: true,
    eventTypes: ['pull_request'],
    branchPattern: '*',
    deploymentMode: 'preview',
    maxAttempts: 1,
    project: { id: 'project-1', name: 'Example App', config: {} },
    ...overrides,
  };
}

function signedHeaders(headers: Record<string, string>) {
  return {
    ...headers,
    'x-devpilot-webhook-secret': 'secret-1',
    'x-devpilot-webhook-timestamp': String(Date.now()),
  };
}

function storedSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

function githubPullRequestPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: 'synchronize',
    number: 42,
    pull_request: {
      number: 42,
      title: 'Add checkout flow',
      html_url: 'https://github.example.test/acme/app/pull/42',
      head: {
        ref: 'feature/checkout',
        sha: 'abc123preview',
      },
      base: {
        ref: 'main',
      },
    },
    ...overrides,
  };
}

function gitlabMergeRequestPayload(overrides: Record<string, unknown> = {}) {
  return {
    object_kind: 'merge_request',
    object_attributes: {
      action: 'update',
      iid: 17,
      title: 'Add cart',
      url: 'https://gitlab.example.test/acme/app/-/merge_requests/17',
      source_branch: 'feature/cart',
      target_branch: 'main',
      ...overrides,
    },
    last_commit: {
      id: 'def456preview',
    },
  };
}
