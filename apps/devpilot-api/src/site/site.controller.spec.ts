import { ControlAccessPolicyService } from '../control-access-policy';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';

describe('SiteController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };
  const site = siteRecord('site-1');

  let siteService: Record<string, jest.Mock>;
  let accessPolicyService: {
    assertCanRead: jest.Mock;
    assertCanWrite: jest.Mock;
    canRead: jest.Mock;
  };
  let controller: SiteController;

  beforeEach(() => {
    siteService = {
      listSites: jest.fn(),
      createSite: jest.fn(),
      getSite: jest.fn(),
      listSyncRuns: jest.fn(),
      updateSite: jest.fn(),
      deleteSite: jest.fn(),
      takeoverPreviewSite: jest.fn(),
      createSyncPlan: jest.fn(),
      createDiagnostics: jest.fn(),
      createOpenRestyModuleBaseline: jest.fn(),
      createOpenRestyModules: jest.fn(),
      createOpenRestyStatus: jest.fn(),
      createSmokeCheck: jest.fn(),
      createTlsProbe: jest.fn(),
      createTlsRenew: jest.fn(),
      rollbackSyncRun: jest.fn(),
    };
    accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanWrite: jest.fn().mockResolvedValue({ allowed: true }),
      canRead: jest.fn().mockResolvedValue(true),
    };
    controller = new SiteController(
      siteService as unknown as SiteService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters site lists through site read policy', async () => {
    siteService.listSites.mockResolvedValue([
      siteRecord('site-allowed'),
      siteRecord('site-denied'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'site-allowed')
    ));

    await expect(controller.listSites(req, { projectId: 'project-1' }))
      .resolves
      .toEqual([siteRecord('site-allowed')]);
    expect(siteService.listSites).toHaveBeenCalledWith(req.teamId, { projectId: 'project-1' });
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'site',
      action: 'site.read',
      targetType: 'site',
      targetId: 'site-denied',
      risk: 'low',
    }));
  });

  it('checks site detail read access before returning it', async () => {
    siteService.getSite.mockResolvedValue(site);

    await expect(controller.getSite(req, 'site-1')).resolves.toEqual(site);
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'site',
      action: 'site.read',
      targetType: 'site',
      targetId: 'site-1',
      risk: 'low',
    }));
  });

  it('checks site read before filtering sync runs', async () => {
    siteService.getSite.mockResolvedValue(site);
    siteService.listSyncRuns.mockResolvedValue([
      syncRun('run-allowed'),
      syncRun('run-denied'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'run-allowed')
    ));

    await expect(controller.listSyncRuns(req, 'site-1', { status: 'completed' }))
      .resolves
      .toEqual([syncRun('run-allowed')]);
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.read',
      targetId: 'site-1',
    }));
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site_sync_run.read',
      targetType: 'site_sync_run',
      targetId: 'run-denied',
    }));
  });

  it('checks create, update migration, and delete write gates', async () => {
    const createDto = { name: 'Site', primaryDomain: 'example.com', projectId: 'project-1', environmentId: 'env-prod' };
    siteService.createSite.mockResolvedValue(site);
    siteService.getSite.mockResolvedValue(site);
    siteService.updateSite.mockResolvedValue(siteRecord('site-1', 'project-2', 'env-staging'));
    siteService.deleteSite.mockResolvedValue({ deleted: true });

    await expect(controller.createSite(req, createDto)).resolves.toEqual(site);
    await expect(controller.updateSite(req, 'site-1', { projectId: 'project-2', environmentId: 'env-staging' }))
      .resolves
      .toEqual(siteRecord('site-1', 'project-2', 'env-staging'));
    await expect(controller.deleteSite(req, 'site-1')).resolves.toEqual({ deleted: true });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.create',
      targetType: 'site',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.update',
      targetId: 'site-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.update',
      targetId: 'site-1',
      projectId: 'project-2',
      environmentId: 'env-staging',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.delete',
      targetId: 'site-1',
      risk: 'high',
    }));
  });

  it('checks dry-run and live site operation risks', async () => {
    siteService.getSite.mockResolvedValue(site);
    siteService.createSyncPlan.mockResolvedValue({ id: 'sync-plan' });
    siteService.createDiagnostics.mockResolvedValue({ id: 'diagnostics' });
    siteService.createTlsRenew.mockResolvedValue({ id: 'tls-renew' });
    siteService.rollbackSyncRun.mockResolvedValue({ id: 'rollback' });

    await expect(controller.createSyncPlan(req, 'site-1', { dryRun: true }))
      .resolves
      .toEqual({ id: 'sync-plan' });
    await expect(controller.createDiagnostics(req, 'site-1', { dryRun: false }))
      .resolves
      .toEqual({ id: 'diagnostics' });
    await expect(controller.createTlsRenew(req, 'site-1', { dryRun: false }))
      .resolves
      .toEqual({ id: 'tls-renew' });
    await expect(controller.rollbackSyncRun(req, 'site-1', 'run-1', { dryRun: false }))
      .resolves
      .toEqual({ id: 'rollback' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.sync',
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.diagnostics',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.tls_renew',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.rollback',
      risk: 'high',
    }));
  });

  it('keeps low-risk operational probes gated before delegating', async () => {
    siteService.getSite.mockResolvedValue(site);
    siteService.createOpenRestyStatus.mockResolvedValue({ id: 'openresty-status' });
    siteService.createSmokeCheck.mockResolvedValue({ id: 'smoke-check' });
    siteService.createTlsProbe.mockResolvedValue({ id: 'tls-probe' });

    await expect(controller.createOpenRestyStatus(req, 'site-1', {}))
      .resolves
      .toEqual({ id: 'openresty-status' });
    await expect(controller.createSmokeCheck(req, 'site-1', {}))
      .resolves
      .toEqual({ id: 'smoke-check' });
    await expect(controller.createTlsProbe(req, 'site-1', {}))
      .resolves
      .toEqual({ id: 'tls-probe' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.openresty_status',
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.smoke_check',
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.tls_probe',
      risk: 'low',
    }));
  });

  it('does not create live sync plans when the write gate rejects', async () => {
    siteService.getSite.mockResolvedValue(site);
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('site denied'));

    await expect(controller.createSyncPlan(req, 'site-1', { dryRun: false }))
      .rejects
      .toThrow('site denied');
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.sync',
      risk: 'medium',
    }));
    expect(siteService.createSyncPlan).not.toHaveBeenCalled();
  });
});

function siteRecord(id: string, projectId = 'project-1', environmentId = 'env-prod') {
  return {
    id,
    projectId,
    environmentId,
    primaryDomain: `${id}.example.com`,
  };
}

function syncRun(id: string) {
  return {
    id,
    projectId: 'project-1',
    environmentId: 'env-prod',
  };
}
