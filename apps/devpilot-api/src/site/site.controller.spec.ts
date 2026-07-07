import { ControlAccessPolicyService } from '../control-access-policy';
import { SiteReadController, SiteWriteController } from './site.controller';
import { SiteService } from './site.service';
import { SiteAccessPolicyService } from './site-access-policy.service';

describe('Site controllers authorization', () => {
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
  let readController: SiteReadController;
  let writeController: SiteWriteController;

  beforeEach(() => {
    siteService = {
      listSites: jest.fn(), createSite: jest.fn(), getSite: jest.fn(), listSyncRuns: jest.fn(),
      updateSite: jest.fn(), deleteSite: jest.fn(), takeoverPreviewSite: jest.fn(),
      createSyncPlan: jest.fn(), createDiagnostics: jest.fn(), createOpenRestyModuleBaseline: jest.fn(),
      createOpenRestyModules: jest.fn(), createOpenRestyStatus: jest.fn(), createSmokeCheck: jest.fn(),
      createTlsProbe: jest.fn(), createTlsRenew: jest.fn(), rollbackSyncRun: jest.fn(),
    };
    accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanWrite: jest.fn().mockResolvedValue({ allowed: true }),
      canRead: jest.fn().mockResolvedValue(true),
    };
    const accessPolicy = new SiteAccessPolicyService(accessPolicyService as unknown as ControlAccessPolicyService);
    readController = new SiteReadController(siteService as unknown as SiteService, accessPolicy);
    writeController = new SiteWriteController(siteService as unknown as SiteService, accessPolicy);
  });

  it('filters site lists through site read policy', async () => {
    siteService.listSites.mockResolvedValue([siteRecord('site-allowed'), siteRecord('site-denied')]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'site-allowed'));
    await expect(readController.listSites(req, { projectId: 'project-1' })).resolves.toEqual([siteRecord('site-allowed')]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({ targetId: 'site-denied' }));
  });

  it('checks getSite through read policy', async () => {
    siteService.getSite.mockResolvedValue(site);
    await expect(readController.getSite(req, 'site-1')).resolves.toEqual(site);
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({ targetId: 'site-1' }));
  });

  it('checks listSyncRuns through read policy', async () => {
    siteService.getSite.mockResolvedValue(site);
    siteService.listSyncRuns.mockResolvedValue([]);
    await expect(readController.listSyncRuns(req, 'site-1', { status: 'completed' })).resolves.toEqual([]);
  });

  it('checks createSite/updateSite/deleteSite through write policy', async () => {
    const createDto = { projectId: 'project-1', environmentId: 'env-dev', primaryDomain: 'example.com', runtimeType: 'reverse_proxy' as const, upstreamUrl: 'http://127.0.0.1:3000' };
    siteService.createSite.mockResolvedValue(site);
    siteService.getSite.mockResolvedValue(site);
    siteService.updateSite.mockResolvedValue(site);
    siteService.deleteSite.mockResolvedValue({ deleted: true });
    await expect(writeController.createSite(req, createDto as any)).resolves.toEqual(site);
    await expect(writeController.updateSite(req, 'site-1', { projectId: 'project-2', environmentId: 'env-staging' } as any)).resolves.toEqual(site);
    await expect(writeController.deleteSite(req, 'site-1')).resolves.toEqual({ deleted: true });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'site.create' }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'site.delete', risk: 'high' }));
  });

  it('checks action routes through write policy', async () => {
    siteService.getSite.mockResolvedValue(site);
    siteService.createSyncPlan.mockResolvedValue({ id: 'run-1' });
    siteService.createDiagnostics.mockResolvedValue({ id: 'run-2' });
    siteService.createTlsRenew.mockResolvedValue({ id: 'run-3' });
    siteService.rollbackSyncRun.mockResolvedValue({ id: 'run-4' });
    await expect(writeController.createSyncPlan(req, 'site-1', { dryRun: true })).resolves.toEqual({ id: 'run-1' });
    await expect(writeController.createDiagnostics(req, 'site-1', { dryRun: false })).resolves.toEqual({ id: 'run-2' });
    await expect(writeController.createTlsRenew(req, 'site-1', { dryRun: false })).resolves.toEqual({ id: 'run-3' });
    await expect(writeController.rollbackSyncRun(req, 'site-1', 'run-1', { dryRun: false })).resolves.toEqual({ id: 'run-4' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'site.sync' }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'site.diagnostics' }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'site.tls_renew' }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'site.rollback', risk: 'high' }));
  });

  it('blocks action routes when write policy denies', async () => {
    siteService.getSite.mockResolvedValue(site);
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('denied'));
    await expect(writeController.createSyncPlan(req, 'site-1', { dryRun: false })).rejects.toThrow('denied');
    expect(siteService.createSyncPlan).not.toHaveBeenCalled();
  });

  it('checks openresty/smoke/tls-probe routes through write policy', async () => {
    siteService.getSite.mockResolvedValue(site);
    siteService.createOpenRestyStatus.mockResolvedValue({ id: 'run-5' });
    siteService.createSmokeCheck.mockResolvedValue({ id: 'run-6' });
    siteService.createTlsProbe.mockResolvedValue({ id: 'run-7' });
    await expect(writeController.createOpenRestyStatus(req, 'site-1', {})).resolves.toEqual({ id: 'run-5' });
    await expect(writeController.createSmokeCheck(req, 'site-1', {})).resolves.toEqual({ id: 'run-6' });
    await expect(writeController.createTlsProbe(req, 'site-1', {})).resolves.toEqual({ id: 'run-7' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'site.openresty_status' }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'site.smoke_check' }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({ action: 'site.tls_probe' }));
  });
});

function siteRecord(id: string) {
  return { id, projectId: 'project-1', environmentId: 'env-dev' };
}
