import { ControlAccessPolicyService } from '../control-access-policy';
import { DomainController } from './domain.controller';
import { SSLMode } from './dto/domain.dto';
import { DomainService } from './domain.service';

describe('DomainController authorization', () => {
  const req = { user: { id: 'user-1' }, teamId: 'team-1' };

  let domainService: {
    validateDomain: jest.Mock;
    generateNginxConfig: jest.Mock;
    generateCertbotScript: jest.Mock;
    generateMultiDomainConfig: jest.Mock;
  };
  let accessPolicyService: {
    assertCanRead: jest.Mock;
    assertCanSelfServiceWrite: jest.Mock;
  };
  let controller: DomainController;

  beforeEach(() => {
    domainService = {
      validateDomain: jest.fn(),
      generateNginxConfig: jest.fn(),
      generateCertbotScript: jest.fn(),
      generateMultiDomainConfig: jest.fn(),
    };
    accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanSelfServiceWrite: jest.fn().mockResolvedValue({ allowed: true }),
    };
    controller = new DomainController(
      domainService as unknown as DomainService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('checks domain validate read access before delegating', async () => {
    domainService.validateDomain.mockReturnValue(true);

    await expect(controller.validateDomain('demo.example.com', req)).resolves.toEqual({
      domain: 'demo.example.com',
      isValid: true,
    });
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'domain_config',
      action: 'domain.validate',
      targetType: 'domain',
      targetId: 'demo.example.com',
      risk: 'low',
    });
  });

  it('checks domain artifact generation write gates', async () => {
    domainService.generateNginxConfig.mockReturnValue('server {}');
    domainService.generateCertbotScript.mockReturnValue('certbot renew');
    domainService.generateMultiDomainConfig.mockReturnValue('server batch {}');

    await expect(controller.generateNginxConfig(domainConfig('demo.example.com'), req)).resolves.toEqual({
      domain: 'demo.example.com',
      configContent: 'server {}',
      filename: 'demo.example.com.conf',
    });
    await expect(controller.generateCertbotScript({ domain: 'demo.example.com', email: 'ops@example.com' }, req))
      .resolves
      .toEqual({ domain: 'demo.example.com', script: 'certbot renew', filename: 'certbot-demo.example.com.sh' });
    await expect(controller.generateMultiDomainConfig([domainConfig('demo.example.com')], req))
      .resolves
      .toEqual({ configContent: 'server batch {}' });

    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'domain.nginx_config.generate',
      targetId: 'demo.example.com',
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'domain.certbot_script.generate',
      targetId: 'demo.example.com',
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'domain.nginx_config.batch_generate',
      targetId: null,
      risk: 'low',
    }));
  });

  it('does not generate domain artifacts when access is denied', async () => {
    accessPolicyService.assertCanSelfServiceWrite.mockRejectedValue(new Error('domain denied'));

    await expect(controller.generateNginxConfig(domainConfig('blocked.example.com'), req))
      .rejects
      .toThrow('domain denied');
    expect(domainService.generateNginxConfig).not.toHaveBeenCalled();
  });
});

function domainConfig(domain: string) {
  return {
    domain,
    upstream: 'http://localhost:3000',
    sslMode: SSLMode.LETSENCRYPT,
  };
}
