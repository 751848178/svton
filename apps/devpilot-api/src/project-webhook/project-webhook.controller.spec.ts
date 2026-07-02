import { ControlAccessPolicyService } from '../control-access-policy';
import { ProjectWebhookController } from './project-webhook.controller';
import { ProjectWebhookService } from './project-webhook.service';

describe('ProjectWebhookController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let webhookService: {
    listWebhooks: jest.Mock;
    resolveWebhookCreateAccessScope: jest.Mock;
    getWebhookAccessScope: jest.Mock;
    resolveWebhookUpdateAccessScope: jest.Mock;
    createWebhook: jest.Mock;
    updateWebhook: jest.Mock;
    rotateWebhookSecret: jest.Mock;
    listDeliveries: jest.Mock;
  };
  let accessPolicyService: {
    assertCanWrite: jest.Mock;
    canRead: jest.Mock;
  };
  let controller: ProjectWebhookController;

  beforeEach(() => {
    webhookService = {
      listWebhooks: jest.fn(),
      resolveWebhookCreateAccessScope: jest.fn(),
      getWebhookAccessScope: jest.fn(),
      resolveWebhookUpdateAccessScope: jest.fn(),
      createWebhook: jest.fn(),
      updateWebhook: jest.fn(),
      rotateWebhookSecret: jest.fn(),
      listDeliveries: jest.fn(),
    };
    accessPolicyService = {
      assertCanWrite: jest.fn().mockResolvedValue({ allowed: true }),
      canRead: jest.fn().mockResolvedValue(true),
    };
    controller = new ProjectWebhookController(
      webhookService as unknown as ProjectWebhookService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters webhook lists through project and environment read policy', async () => {
    webhookService.listWebhooks.mockResolvedValue([
      webhookRecord('webhook-allowed', 'project-1', 'env-prod'),
      webhookRecord('webhook-denied', 'project-2', 'env-prod'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'webhook-allowed')
    ));

    await expect(controller.listWebhooks(req, { projectId: 'project-1' }))
      .resolves
      .toEqual([webhookRecord('webhook-allowed', 'project-1', 'env-prod')]);
    expect(webhookService.listWebhooks).toHaveBeenCalledWith(req.teamId, { projectId: 'project-1' });
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-2',
      environmentId: 'env-prod',
      category: 'deployment',
      action: 'project_webhook.read',
      targetType: 'project_webhook',
      targetId: 'webhook-denied',
      risk: 'low',
    }));
  });

  it('filters webhook deliveries through delivery scope fallback', async () => {
    webhookService.listDeliveries.mockResolvedValue([
      deliveryRecord('delivery-allowed', 'project-1', 'env-prod', null),
      deliveryRecord('delivery-denied', 'project-1', null, 'env-staging'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'delivery-allowed')
    ));

    await expect(controller.listDeliveries(req, { projectId: 'project-1' }))
      .resolves
      .toEqual([deliveryRecord('delivery-allowed', 'project-1', 'env-prod', null)]);
    expect(webhookService.listDeliveries).toHaveBeenCalledWith(req.teamId, { projectId: 'project-1' });
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-staging',
      category: 'deployment',
      action: 'webhook_delivery.read',
      targetType: 'webhook_delivery',
      targetId: 'delivery-denied',
      risk: 'low',
    }));
  });

  it('checks create webhook write scope before delegating', async () => {
    const dto = { projectId: 'project-1', environmentId: 'env-prod' };
    const created = webhookRecord('webhook-1', 'project-1', 'env-prod');
    webhookService.resolveWebhookCreateAccessScope.mockResolvedValue({
      projectId: 'project-1',
      environmentId: 'env-prod',
    });
    webhookService.createWebhook.mockResolvedValue(created);

    await expect(controller.createWebhook(req, dto)).resolves.toEqual(created);
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'deployment',
      action: 'project_webhook.create',
      targetType: 'project_webhook',
      targetId: null,
      risk: 'medium',
    }));
    expect(webhookService.createWebhook).toHaveBeenCalledWith(req.teamId, req.user.id, dto);
  });

  it('checks current and target scope when webhook environment changes', async () => {
    const updated = webhookRecord('webhook-1', 'project-1', 'env-staging');
    webhookService.getWebhookAccessScope.mockResolvedValue({
      projectId: 'project-1',
      environmentId: 'env-prod',
    });
    webhookService.resolveWebhookUpdateAccessScope.mockResolvedValue({
      projectId: 'project-1',
      environmentId: 'env-staging',
    });
    webhookService.updateWebhook.mockResolvedValue(updated);

    await expect(controller.updateWebhook(req, 'webhook-1', { environmentId: 'env-staging' }))
      .resolves
      .toEqual(updated);
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_webhook.update',
      targetId: 'webhook-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_webhook.update',
      targetId: 'webhook-1',
      projectId: 'project-1',
      environmentId: 'env-staging',
      risk: 'medium',
    }));
    expect(webhookService.updateWebhook).toHaveBeenCalledWith(
      req.teamId,
      'webhook-1',
      { environmentId: 'env-staging' },
    );
  });

  it('checks rotate-secret as a high-risk webhook write', async () => {
    webhookService.getWebhookAccessScope.mockResolvedValue({
      projectId: 'project-1',
      environmentId: 'env-prod',
    });
    webhookService.rotateWebhookSecret.mockResolvedValue({ id: 'webhook-1', setupSecret: 'next' });

    await expect(controller.rotateWebhookSecret(req, 'webhook-1'))
      .resolves
      .toEqual({ id: 'webhook-1', setupSecret: 'next' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_webhook.secret.rotate',
      targetType: 'project_webhook',
      targetId: 'webhook-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      risk: 'high',
    }));
  });

  it('does not delegate webhook writes when access is denied', async () => {
    webhookService.getWebhookAccessScope.mockResolvedValue({
      projectId: 'project-1',
      environmentId: 'env-prod',
    });
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('denied'));

    await expect(controller.rotateWebhookSecret(req, 'webhook-1')).rejects.toThrow('denied');
    expect(webhookService.rotateWebhookSecret).not.toHaveBeenCalled();
  });
});

function webhookRecord(id: string, projectId: string, environmentId: string | null) {
  return {
    id,
    projectId,
    environmentId,
  };
}

function deliveryRecord(
  id: string,
  projectId: string,
  webhookEnvironmentId: string | null,
  deploymentEnvironmentId: string | null,
) {
  return {
    id,
    projectId,
    webhook: webhookEnvironmentId ? { environmentId: webhookEnvironmentId } : null,
    deploymentRun: deploymentEnvironmentId ? { environmentId: deploymentEnvironmentId } : null,
  };
}
