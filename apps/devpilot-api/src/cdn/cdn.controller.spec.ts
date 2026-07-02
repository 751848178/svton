import { ControlAccessPolicyService } from '../control-access-policy';
import { CDNController } from './cdn.controller';
import { CDNProvider } from './dto/cdn.dto';
import { CDNService } from './cdn.service';

describe('CDNController authorization', () => {
  const req = { user: { id: 'user-1' }, teamId: 'team-1' };

  let cdnService: {
    generateCDNUrlConfig: jest.Mock;
    generateFrontendConfig: jest.Mock;
    generateRefreshScript: jest.Mock;
    generateNextJSConfig: jest.Mock;
    generateEnvConfig: jest.Mock;
  };
  let accessPolicyService: {
    assertCanSelfServiceWrite: jest.Mock;
  };
  let controller: CDNController;

  beforeEach(() => {
    cdnService = {
      generateCDNUrlConfig: jest.fn(),
      generateFrontendConfig: jest.fn(),
      generateRefreshScript: jest.fn(),
      generateNextJSConfig: jest.fn(),
      generateEnvConfig: jest.fn(),
    };
    accessPolicyService = {
      assertCanSelfServiceWrite: jest.fn().mockResolvedValue({ allowed: true }),
    };
    controller = new CDNController(
      cdnService as unknown as CDNService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('checks CDN URL artifact write access before delegating', async () => {
    cdnService.generateCDNUrlConfig.mockReturnValue({ baseUrl: 'https://cdn.example.com' });

    await expect(controller.generateUrlConfig(cdnConfig(), req)).resolves.toEqual({
      baseUrl: 'https://cdn.example.com',
    });
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'cdn_artifact',
      action: 'cdn.url_config.generate',
      targetType: 'cdn_artifact',
      targetId: CDNProvider.ALIYUN,
      risk: 'low',
    });
    expect(cdnService.generateCDNUrlConfig).toHaveBeenCalledWith(cdnConfig());
  });

  it('checks frontend refresh nextjs and env artifact write gates', async () => {
    cdnService.generateFrontendConfig.mockReturnValue('export const cdn = true;');
    cdnService.generateRefreshScript.mockReturnValue('aliyun cdn refresh');
    cdnService.generateNextJSConfig.mockReturnValue('module.exports = {};');
    cdnService.generateEnvConfig.mockReturnValue('CDN_PROVIDER=aliyun');

    await expect(controller.generateFrontendConfig(cdnConfig(), req)).resolves.toEqual({
      filename: 'cdn.config.ts',
      content: 'export const cdn = true;',
    });
    await expect(controller.generateRefreshScript(cdnConfig(), req)).resolves.toEqual({
      filename: 'cdn-refresh-aliyun.sh',
      content: 'aliyun cdn refresh',
    });
    await expect(controller.generateNextJSConfig(cdnConfig(), req)).resolves.toEqual({
      filename: 'next.config.cdn.js',
      content: 'module.exports = {};',
    });
    await expect(controller.generateEnvConfig(cdnConfig(), req)).resolves.toEqual({
      filename: '.env.cdn',
      content: 'CDN_PROVIDER=aliyun',
    });

    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'cdn.frontend_config.generate',
      targetId: CDNProvider.ALIYUN,
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'cdn.refresh_script.generate',
      targetId: CDNProvider.ALIYUN,
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'cdn.nextjs_config.generate',
      targetId: CDNProvider.ALIYUN,
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'cdn.env_config.generate',
      targetId: CDNProvider.ALIYUN,
      risk: 'low',
    }));
  });

  it('does not generate CDN artifacts when access is denied', async () => {
    accessPolicyService.assertCanSelfServiceWrite.mockRejectedValue(new Error('cdn denied'));

    await expect(controller.generateEnvConfig(cdnConfig(), req)).rejects.toThrow('cdn denied');
    expect(cdnService.generateEnvConfig).not.toHaveBeenCalled();
  });
});

function cdnConfig() {
  return {
    provider: CDNProvider.ALIYUN,
    domain: 'cdn.example.com',
    originDomain: 'origin.example.com',
    enableHttps: true,
  };
}
