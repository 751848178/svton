import { AuditEventService } from '../audit-event';
import { OperationApprovalService } from '../operation-approval';
import { PrismaService } from '../prisma/prisma.service';
import { ServerExecutorService } from '../server-executor';
import { SiteService } from './site.service';

const opensslOutput = [
  'subject=CN = api.example.com',
  'issuer=C = US, O = Let Encrypt Test, CN = R3',
  'serial=ABC123',
  'notBefore=Jun  1 00:00:00 2026 GMT',
  'notAfter=Jul  1 00:00:00 2026 GMT',
  'sha256 Fingerprint=AA:BB:CC',
].join('\n');

describe('SiteService TLS probe', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a Server executor TLS probe and merges certificate metadata into Site.tls', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-27T00:00:00.000Z'));

    const site = {
      id: 'site-1',
      teamId: 'team-1',
      createdById: 'user-1',
      name: 'API',
      primaryDomain: 'api.example.com',
      aliases: [],
      runtimeType: 'reverse_proxy',
      runtimeConfig: { upstreamUrl: 'http://127.0.0.1:3000' },
      tls: { enabled: true, type: 'letsencrypt', email: 'ops@example.com' },
      accessPolicy: {},
      status: 'active',
      projectId: 'project-1',
      environmentId: 'env-prod',
      serverId: 'server-1',
      proxyConfigId: null,
      lastSyncAt: null,
      syncError: null,
      createdAt: new Date('2026-06-27T00:00:00.000Z'),
      updatedAt: new Date('2026-06-27T00:00:00.000Z'),
      project: { id: 'project-1', name: '项目 A' },
      environment: { id: 'env-prod', key: 'prod', name: '生产', status: 'active' },
      server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
      proxyConfig: null,
      createdBy: { id: 'user-1', name: 'Owner', email: 'owner@example.test' },
    };
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn((args) => Promise.resolve({
          ...site,
          tls: args.data.tls,
        })),
      },
      siteSyncRun: {
        create: jest.fn((args) => Promise.resolve({
          id: 'run-1',
          ...args.data,
        })),
        update: jest.fn((args) => Promise.resolve({
          id: 'run-1',
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        mode: 'executed',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [{ stream: 'stdout', message: opensslOutput }],
        result: { stdoutPreview: opensslOutput },
      }),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      { resolveApproved: jest.fn(), createPending: jest.fn(), consume: jest.fn() } as unknown as OperationApprovalService,
    );

    const result = await service.createTlsProbe('team-1', 'user-1', 'site-1', { dryRun: false });

    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'site.tls_probe',
      adapterKey: 'nginx-site-plan',
      dryRun: false,
      requiredConfirmationText: undefined,
      metadata: expect.objectContaining({
        siteId: 'site-1',
        mode: 'tls_probe',
        tlsProbeHost: 'api.example.com',
        tlsProbePort: 443,
      }),
      steps: [
        expect.objectContaining({
          key: 'probe_tls_certificate',
          command: expect.stringContaining('openssl s_client -servername api.example.com'),
        }),
      ],
    }));
    expect(prisma.site.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'site-1' },
      data: {
        tls: expect.objectContaining({
          enabled: true,
          type: 'letsencrypt',
          expiresAt: '2026-07-01T00:00:00.000Z',
          notAfter: '2026-07-01T00:00:00.000Z',
          lastProbedAt: '2026-06-27T00:00:00.000Z',
          currentCertificateAssetId: 'sha256:AA:BB:CC',
          certificateAssetCount: 1,
          certificate: expect.objectContaining({
            issuer: 'C = US, O = Let Encrypt Test, CN = R3',
            daysRemaining: 4,
          }),
          assets: [
            expect.objectContaining({
              id: 'sha256:AA:BB:CC',
              kind: 'observed_tls_certificate',
              active: true,
              managed: false,
              firstSeenAt: '2026-06-27T00:00:00.000Z',
              lastSeenAt: '2026-06-27T00:00:00.000Z',
              observationCount: 1,
              fingerprintSha256: 'AA:BB:CC',
            }),
          ],
        }),
      },
    }));
    expect(result.site.tls).toEqual(expect.objectContaining({
      expiresAt: '2026-07-01T00:00:00.000Z',
      daysRemaining: 4,
    }));
  });

  it('creates a dry-run TLS renewal plan by default and records renewal metadata', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-27T00:00:00.000Z'));

    const site = siteFixture();
    const certbotOutput = 'Congratulations, all simulated renewals succeeded: api.example.com';
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn((args) => Promise.resolve({
          ...site,
          tls: args.data.tls,
        })),
      },
      siteSyncRun: {
        create: jest.fn((args) => Promise.resolve({
          id: 'run-renew-1',
          ...args.data,
        })),
        update: jest.fn((args) => Promise.resolve({
          id: 'run-renew-1',
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        mode: 'dry_run',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [{ stream: 'stdout', message: certbotOutput }],
        result: { stdoutPreview: certbotOutput },
      }),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      { resolveApproved: jest.fn(), createPending: jest.fn(), consume: jest.fn() } as unknown as OperationApprovalService,
    );

    const result = await service.createTlsRenew('team-1', 'user-1', 'site-1', {});

    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'site.tls_renew',
      adapterKey: 'nginx-site-plan',
      dryRun: true,
      requiredConfirmationText: 'API',
      metadata: expect.objectContaining({
        siteId: 'site-1',
        mode: 'tls_renew',
      }),
      steps: [
        expect.objectContaining({
          key: 'renew_tls_certificate',
          command: 'certbot renew --cert-name api.example.com --dry-run --non-interactive',
        }),
        expect.objectContaining({
          key: 'validate_nginx',
          required: false,
        }),
        expect.objectContaining({
          key: 'reload_nginx',
          required: false,
        }),
      ],
    }));
    expect(prisma.site.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'site-1' },
      data: {
        tls: expect.objectContaining({
          type: 'letsencrypt',
          lastRenewalStatus: 'succeeded',
          lastRenewalCheckedAt: '2026-06-27T00:00:00.000Z',
          lastRenewalDryRunAt: '2026-06-27T00:00:00.000Z',
          lastRenewalRunId: 'run-renew-1',
          renewal: expect.objectContaining({
            source: 'certbot_renew',
            status: 'succeeded',
            dryRun: true,
            attempted: true,
            succeeded: true,
            runId: 'run-renew-1',
            summary: certbotOutput,
          }),
        }),
      },
    }));
    expect(prisma.siteSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mode: 'tls_renew',
        trigger: 'manual_tls_renew',
        dryRun: true,
      }),
    }));
    expect(result.syncRun.id).toBe('run-renew-1');
    expect(result.site.tls).toEqual(expect.objectContaining({
      lastRenewalStatus: 'succeeded',
      renewal: expect.objectContaining({
        dryRun: true,
        status: 'succeeded',
      }),
    }));
  });

  it('queues a follow-up TLS probe after successful live TLS renewal', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-27T00:00:00.000Z'));

    const site = siteFixture();
    const certbotOutput = 'Congratulations, all renewals succeeded: api.example.com';
    let createCount = 0;
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn((args) => Promise.resolve({
          ...site,
          tls: args.data.tls,
        })),
      },
      siteSyncRun: {
        create: jest.fn((args) => {
          createCount += 1;
          return Promise.resolve({
            id: createCount === 1 ? 'run-renew-1' : 'run-probe-1',
            ...args.data,
          });
        }),
        update: jest.fn((args) => Promise.resolve({
          id: args.where.id,
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        mode: 'executed',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [{ stream: 'stdout', message: certbotOutput }],
        result: { stdoutPreview: certbotOutput },
      }),
      queueExecution: jest.fn().mockResolvedValue({
        status: 'queued',
        mode: 'queued',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [],
        result: {},
        serverExecutionJobId: 'job-probe-1',
      }),
    };
    const operationApprovalService = {
      resolveApproved: jest.fn().mockResolvedValue({ id: 'approval-1', status: 'approved' }),
      createPending: jest.fn(),
      consume: jest.fn(),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      operationApprovalService as unknown as OperationApprovalService,
    );

    const result = await service.createTlsRenew('team-1', 'user-1', 'site-1', {
      dryRun: false,
      confirmationText: 'API',
      approvalId: 'approval-1',
    });

    expect(prisma.siteSyncRun.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        mode: 'tls_probe',
        trigger: 'renewal_follow_up_tls_probe',
        dryRun: false,
        sourceRunId: 'run-renew-1',
      }),
    }));
    expect(serverExecutor.queueExecution).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'site.tls_probe',
      adapterKey: 'nginx-site-plan',
      dryRun: false,
      metadata: expect.objectContaining({
        siteId: 'site-1',
        siteSyncRunId: 'run-probe-1',
        mode: 'tls_probe',
        trigger: 'renewal_follow_up_tls_probe',
        sourceRunId: 'run-renew-1',
      }),
      steps: [
        expect.objectContaining({
          key: 'probe_tls_certificate',
          command: expect.stringContaining('openssl s_client -servername api.example.com'),
        }),
      ],
    }), { maxAttempts: 1 });
    expect(prisma.site.update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'site-1' },
      data: {
        tls: expect.objectContaining({
          lastRenewalFollowUpProbeStatus: 'queued',
          lastRenewalFollowUpProbeRunId: 'run-probe-1',
          lastRenewalFollowUpProbeJobId: 'job-probe-1',
          renewal: expect.objectContaining({
            followUpProbe: expect.objectContaining({
              status: 'queued',
              sourceRenewalRunId: 'run-renew-1',
              siteSyncRunId: 'run-probe-1',
              serverExecutionJobId: 'job-probe-1',
            }),
          }),
        }),
      },
    }));
    expect(result.site.tls).toEqual(expect.objectContaining({
      lastRenewalFollowUpProbeStatus: 'queued',
      renewal: expect.objectContaining({
        followUpProbe: expect.objectContaining({
          status: 'queued',
          siteSyncRunId: 'run-probe-1',
        }),
      }),
    }));
  });

  it('creates a low-risk site smoke check without mutating site state', async () => {
    const site = siteFixture();
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn(),
      },
      siteSyncRun: {
        create: jest.fn((args) => Promise.resolve({
          id: 'run-smoke-1',
          ...args.data,
        })),
        update: jest.fn((args) => Promise.resolve({
          id: 'run-smoke-1',
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        mode: 'executed',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [{ stream: 'stdout', message: 'ok' }],
        result: { stdoutPreview: 'ok' },
      }),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      { resolveApproved: jest.fn(), createPending: jest.fn(), consume: jest.fn() } as unknown as OperationApprovalService,
    );

    const result = await service.createSmokeCheck('team-1', 'user-1', 'site-1', { dryRun: false });

    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'site.smoke_check',
      adapterKey: 'nginx-site-plan',
      dryRun: false,
      metadata: expect.objectContaining({
        siteId: 'site-1',
        mode: 'smoke_check',
        trigger: 'manual_smoke_check',
      }),
      steps: [
        expect.objectContaining({
          key: 'public_domain_smoke',
          command: 'curl -fsS https://api.example.com',
        }),
        expect.objectContaining({
          key: 'nginx_local_host_smoke',
          command: "curl -fsS -H 'Host: api.example.com' http://127.0.0.1/",
        }),
        expect.objectContaining({
          key: 'upstream_smoke',
          command: 'curl -fsS http://127.0.0.1:3000',
        }),
      ],
    }));
    expect(prisma.site.update).not.toHaveBeenCalled();
    expect(prisma.siteSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mode: 'smoke_check',
        trigger: 'manual_smoke_check',
        dryRun: false,
        targetConfigPath: 'smoke://api.example.com',
      }),
    }));
    expect(result.mode).toBe('executed');
    expect(result.syncRun.id).toBe('run-smoke-1');
  });

  it('passes placeholder sync warnings to the Server executor for preview draft Sites', async () => {
    const warning = 'preview_site_placeholder_requires_runtime_and_domain_confirmation';
    const site = {
      ...siteFixture(),
      name: 'Preview Site #42',
      primaryDomain: 'preview-pr-42.preview.devpilot.local',
      runtimeConfig: {
        placeholder: true,
        syncBlocked: true,
        syncBlockedReason: warning,
        preview: {
          kind: 'draft_site_placeholder',
          status: 'draft',
        },
      },
      tls: { enabled: false, type: 'none' },
      status: 'draft',
      environmentId: 'env-preview-pr-42',
      environment: { id: 'env-preview-pr-42', key: 'preview-pr-42', name: 'PR #42 Preview', status: 'active' },
    };
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn(),
      },
      siteSyncRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn((args) => Promise.resolve({
          id: 'run-preview-site-sync',
          ...args.data,
        })),
        update: jest.fn((args) => Promise.resolve({
          id: 'run-preview-site-sync',
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        mode: 'dry_run',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: false,
        warnings: [warning],
        commandSteps: [],
        commandPlan: {},
        logs: [],
        result: {},
      }),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      { resolveApproved: jest.fn(), createPending: jest.fn(), consume: jest.fn() } as unknown as OperationApprovalService,
    );

    const result = await service.createSyncPlan('team-1', 'user-1', 'site-1', {});

    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'site.sync',
      adapterKey: 'nginx-site-plan',
      dryRun: true,
      warnings: expect.arrayContaining([warning]),
      blockOnWarnings: false,
      metadata: expect.objectContaining({
        siteId: 'site-1',
        mode: 'sync',
        trigger: 'manual',
        primaryDomain: 'preview-pr-42.preview.devpilot.local',
      }),
    }));
    expect(prisma.siteSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mode: 'sync',
        trigger: 'manual',
        dryRun: true,
        warnings: expect.arrayContaining([warning]),
        targetConfigPath: '/etc/nginx/conf.d/preview-pr-42.preview.devpilot.local.conf',
      }),
    }));
    expect(result.warnings).toEqual([warning]);
  });

  it('activates a preview draft Site placeholder and creates a clean dry-run sync plan', async () => {
    const placeholderWarning = 'preview_site_placeholder_requires_runtime_and_domain_confirmation';
    let site: Record<string, unknown> = {
      ...siteFixture(),
      name: 'Preview Site #42',
      primaryDomain: 'preview-pr-42.preview.devpilot.local',
      runtimeConfig: {
        placeholder: true,
        syncBlocked: true,
        syncBlockedReason: placeholderWarning,
        preview: {
          enabled: true,
          kind: 'draft_site_placeholder',
          status: 'draft',
          syncBlocked: true,
          pullRequestNumber: 42,
        },
      },
      tls: { enabled: false, type: 'none' },
      status: 'draft',
      serverId: null,
      server: null,
      environmentId: 'env-preview-pr-42',
      environment: { id: 'env-preview-pr-42', key: 'preview-pr-42', name: 'PR #42 Preview', status: 'active' },
    };
    const prisma = {
      site: {
        findFirst: jest.fn(() => Promise.resolve(site)),
        update: jest.fn((args) => {
          site = {
            ...site,
            ...args.data,
            server: args.data.serverId
              ? { id: args.data.serverId, name: 'preview-1', host: '10.0.0.42', status: 'online' }
              : null,
            updatedAt: new Date('2026-06-28T00:00:00.000Z'),
          };
          return Promise.resolve(site);
        }),
      },
      server: {
        findFirst: jest.fn().mockResolvedValue({ id: 'server-preview-1' }),
      },
      siteSyncRun: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn((args) => Promise.resolve({
          id: 'run-preview-takeover',
          ...args.data,
        })),
        update: jest.fn((args) => Promise.resolve({
          id: 'run-preview-takeover',
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-preview-1',
        serverName: 'preview-1',
        serverHost: '10.0.0.42',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        mode: 'dry_run',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [],
        result: {},
      }),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      { resolveApproved: jest.fn(), createPending: jest.fn(), consume: jest.fn() } as unknown as OperationApprovalService,
    );

    const result = await service.takeoverPreviewSite('team-1', 'user-1', 'site-1', {
      serverId: 'server-preview-1',
      upstreamUrl: 'http://127.0.0.1:3042',
      websocket: true,
    });

    expect(prisma.site.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'site-1' },
      data: expect.objectContaining({
        serverId: 'server-preview-1',
        runtimeType: 'reverse_proxy',
        status: 'pending',
        syncError: null,
        runtimeConfig: expect.objectContaining({
          placeholder: false,
          syncBlocked: false,
          upstreamUrl: 'http://127.0.0.1:3042',
          websocket: true,
          preview: expect.objectContaining({
            kind: 'draft_site_placeholder',
            status: 'ready_for_sync',
            syncBlocked: false,
            activatedById: 'user-1',
            upstreamUrl: 'http://127.0.0.1:3042',
          }),
        }),
      }),
      include: expect.any(Object),
    }));
    expect(prisma.siteSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mode: 'sync',
        trigger: 'manual',
        dryRun: true,
        warnings: [],
        targetConfigPath: '/etc/nginx/conf.d/preview-pr-42.preview.devpilot.local.conf',
      }),
    }));
    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'site.sync',
      adapterKey: 'nginx-site-plan',
      dryRun: true,
      warnings: [],
      blockOnWarnings: false,
      steps: expect.arrayContaining([
        expect.objectContaining({
          key: 'write_nginx_config',
          command: expect.stringContaining('proxy_pass http://127.0.0.1:3042'),
        }),
      ]),
    }));
    expect(result.site.runtimeConfig).toEqual(expect.objectContaining({
      placeholder: false,
      syncBlocked: false,
    }));
    expect(result.syncPlan?.warnings).toEqual([]);
  });

  it('rejects preview takeover for non-preview Site records', async () => {
    const site = siteFixture();
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn(),
      },
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      { resolveTarget: jest.fn(), execute: jest.fn() } as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      { resolveApproved: jest.fn(), createPending: jest.fn(), consume: jest.fn() } as unknown as OperationApprovalService,
    );

    await expect(service.takeoverPreviewSite('team-1', 'user-1', 'site-1', {
      serverId: 'server-1',
      upstreamUrl: 'http://127.0.0.1:3000',
    })).rejects.toThrow('只有 PR Preview draft Site 占位可以执行预览接管');
    expect(prisma.site.update).not.toHaveBeenCalled();
  });

  it('creates a low-risk OpenResty runtime status probe without mutating site state', async () => {
    const site = siteFixture();
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn(),
      },
      siteSyncRun: {
        create: jest.fn((args) => Promise.resolve({
          id: 'run-status-1',
          ...args.data,
        })),
        update: jest.fn((args) => Promise.resolve({
          id: 'run-status-1',
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        mode: 'executed',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [{ stream: 'stdout', message: 'nginx version: nginx/1.24.0' }],
        result: { stdoutPreview: 'nginx version: nginx/1.24.0' },
      }),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      { resolveApproved: jest.fn(), createPending: jest.fn(), consume: jest.fn() } as unknown as OperationApprovalService,
    );

    const result = await service.createOpenRestyStatus('team-1', 'user-1', 'site-1', { dryRun: false });

    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'site.openresty_status',
      adapterKey: 'nginx-site-plan',
      dryRun: false,
      metadata: expect.objectContaining({
        siteId: 'site-1',
        mode: 'openresty_status',
        trigger: 'manual_openresty_status',
      }),
      steps: [
        expect.objectContaining({
          key: 'nginx_config_test_status',
          command: 'nginx -t 2>&1 || true',
        }),
        expect.objectContaining({
          key: 'nginx_build_info',
          command: 'nginx -V 2>&1 || true',
        }),
        expect.objectContaining({
          key: 'openresty_build_info',
          command: 'openresty -V 2>&1 || true',
        }),
        expect.objectContaining({
          key: 'nginx_service_status',
          command: 'systemctl is-active nginx || true',
        }),
        expect.objectContaining({
          key: 'openresty_service_status',
          command: 'systemctl is-active openresty || true',
        }),
        expect.objectContaining({
          key: 'nginx_openresty_process_status',
          command: "ps -eo pid,comm,args | grep -E 'nginx|openresty' | grep -v grep | head -20 || true",
        }),
      ],
    }));
    expect(prisma.site.update).not.toHaveBeenCalled();
    expect(prisma.siteSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mode: 'openresty_status',
        trigger: 'manual_openresty_status',
        dryRun: false,
        targetConfigPath: 'openresty-status://api.example.com',
      }),
    }));
    expect(result.mode).toBe('executed');
    expect(result.syncRun.id).toBe('run-status-1');
  });

  it('creates a low-risk OpenResty module inventory without mutating site state', async () => {
    const site = siteFixture();
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn(),
      },
      siteSyncRun: {
        create: jest.fn((args) => Promise.resolve({
          id: 'run-modules-1',
          ...args.data,
        })),
        update: jest.fn((args) => Promise.resolve({
          id: 'run-modules-1',
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        mode: 'executed',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [{ stream: 'stdout', message: '--with-http_ssl_module' }],
        result: { stdoutPreview: '--with-http_ssl_module' },
      }),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      { resolveApproved: jest.fn(), createPending: jest.fn(), consume: jest.fn() } as unknown as OperationApprovalService,
    );

    const result = await service.createOpenRestyModules('team-1', 'user-1', 'site-1', { dryRun: false });

    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'site.openresty_modules',
      adapterKey: 'nginx-site-plan',
      dryRun: false,
      metadata: expect.objectContaining({
        siteId: 'site-1',
        mode: 'openresty_modules',
        trigger: 'manual_openresty_modules',
      }),
      steps: [
        expect.objectContaining({
          key: 'nginx_module_config_args',
          command: 'nginx -V 2>&1 || true',
        }),
        expect.objectContaining({
          key: 'openresty_module_config_args',
          command: 'openresty -V 2>&1 || true',
        }),
        expect.objectContaining({
          key: 'nginx_dynamic_module_files',
          command: "find /etc/nginx/modules-enabled /usr/lib/nginx/modules /usr/local/openresty/nginx/modules -maxdepth 1 -type f -name '*.so' -print 2>/dev/null | sort || true",
        }),
      ],
    }));
    expect(prisma.site.update).not.toHaveBeenCalled();
    expect(prisma.siteSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mode: 'openresty_modules',
        trigger: 'manual_openresty_modules',
        dryRun: false,
        targetConfigPath: 'openresty-modules://api.example.com',
      }),
    }));
    expect(result.mode).toBe('executed');
    expect(result.syncRun.id).toBe('run-modules-1');
  });

  it('creates a low-risk OpenResty module baseline check without mutating site state', async () => {
    const site = siteFixture();
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn(),
      },
      siteSyncRun: {
        create: jest.fn((args) => Promise.resolve({
          id: 'run-baseline-1',
          ...args.data,
        })),
        update: jest.fn((args) => Promise.resolve({
          id: 'run-baseline-1',
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      }),
      execute: jest.fn().mockResolvedValue({
        status: 'completed',
        mode: 'executed',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [{ stream: 'stdout', message: 'present: tls\nmissing: lua' }],
        result: { stdoutPreview: 'present: tls\nmissing: lua' },
      }),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      { resolveApproved: jest.fn(), createPending: jest.fn(), consume: jest.fn() } as unknown as OperationApprovalService,
    );

    const result = await service.createOpenRestyModuleBaseline('team-1', 'user-1', 'site-1', { dryRun: false });

    expect(serverExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({
      operationKey: 'site.openresty_module_baseline',
      adapterKey: 'nginx-site-plan',
      dryRun: false,
      metadata: expect.objectContaining({
        siteId: 'site-1',
        mode: 'openresty_module_baseline',
        trigger: 'manual_openresty_module_baseline',
      }),
      steps: [
        expect.objectContaining({
          key: 'baseline_tls_module',
          command: expect.stringContaining("echo 'present: tls'"),
        }),
        expect.objectContaining({
          key: 'baseline_http2_module',
          command: expect.stringContaining("echo 'present: http2_or_http3'"),
        }),
        expect.objectContaining({
          key: 'baseline_realip_module',
          command: expect.stringContaining("echo 'present: realip'"),
        }),
        expect.objectContaining({
          key: 'baseline_stub_status_module',
          command: expect.stringContaining("echo 'present: stub_status'"),
        }),
        expect.objectContaining({
          key: 'baseline_stream_module',
          command: expect.stringContaining("echo 'present: stream'"),
        }),
        expect.objectContaining({
          key: 'baseline_lua_module',
          command: expect.stringContaining("echo 'present: lua'"),
        }),
      ],
    }));
    expect(prisma.site.update).not.toHaveBeenCalled();
    expect(prisma.siteSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mode: 'openresty_module_baseline',
        trigger: 'manual_openresty_module_baseline',
        dryRun: false,
        targetConfigPath: 'openresty-module-baseline://api.example.com',
      }),
    }));
    expect(result.mode).toBe('executed');
    expect(result.syncRun.id).toBe('run-baseline-1');
  });

  it('blocks live TLS renewal behind operation approval', async () => {
    const site = siteFixture();
    const approval = { id: 'approval-1', status: 'pending', risk: 'medium' };
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue(site),
        update: jest.fn(),
      },
      siteSyncRun: {
        create: jest.fn((args) => Promise.resolve({
          id: 'run-renew-1',
          ...args.data,
        })),
        update: jest.fn((args) => Promise.resolve({
          id: 'run-renew-1',
          ...args.data,
        })),
      },
    };
    const serverExecutor = {
      resolveTarget: jest.fn().mockResolvedValue({
        transport: 'ssh',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      }),
      execute: jest.fn(),
      queueExecution: jest.fn(),
    };
    const operationApprovalService = {
      resolveApproved: jest.fn().mockResolvedValue(null),
      createPending: jest.fn().mockResolvedValue(approval),
      consume: jest.fn(),
    };
    const service = new SiteService(
      prisma as unknown as PrismaService,
      serverExecutor as unknown as ServerExecutorService,
      { create: jest.fn().mockResolvedValue({}) } as unknown as AuditEventService,
      operationApprovalService as unknown as OperationApprovalService,
    );

    const result = await service.createTlsRenew('team-1', 'user-1', 'site-1', {
      dryRun: false,
      confirmationText: 'API',
    });

    expect(operationApprovalService.createPending).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.tls_renew',
      risk: 'medium',
      summary: '申请执行TLS 证书续期 API',
      metadata: expect.objectContaining({
        mode: 'tls_renew',
        siteSyncRunId: 'run-renew-1',
      }),
    }));
    expect(serverExecutor.execute).not.toHaveBeenCalled();
    expect(serverExecutor.queueExecution).not.toHaveBeenCalled();
    expect(result.status).toBe('blocked');
    expect(result.approval).toBe(approval);
  });
});

function siteFixture() {
  return {
    id: 'site-1',
    teamId: 'team-1',
    createdById: 'user-1',
    name: 'API',
    primaryDomain: 'api.example.com',
    aliases: [],
    runtimeType: 'reverse_proxy',
    runtimeConfig: { upstreamUrl: 'http://127.0.0.1:3000' },
    tls: { enabled: true, type: 'letsencrypt', email: 'ops@example.com' },
    accessPolicy: {},
    status: 'active',
    projectId: 'project-1',
    environmentId: 'env-prod',
    serverId: 'server-1',
    proxyConfigId: null,
    lastSyncAt: null,
    syncError: null,
    createdAt: new Date('2026-06-27T00:00:00.000Z'),
    updatedAt: new Date('2026-06-27T00:00:00.000Z'),
    project: { id: 'project-1', name: '项目 A' },
    environment: { id: 'env-prod', key: 'prod', name: '生产', status: 'active' },
    server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
    proxyConfig: null,
    createdBy: { id: 'user-1', name: 'Owner', email: 'owner@example.test' },
  };
}
