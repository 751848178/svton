import { CDNController } from '../cdn/cdn.controller';
import { CDNProvider } from '../cdn/dto/cdn.dto';
import { DomainController } from '../domain/domain.controller';
import { GeneratorController } from '../generator/generator.controller';
import { GitController } from '../git/git.controller';
import { PresetController } from '../preset/preset.controller';

describe('early delivery controller authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  const createAccessPolicyService = () => ({
    assertCanSelfServiceWrite: jest.fn().mockResolvedValue({ allowed: true }),
    assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
  });

  it('checks project preview policy before generating files', async () => {
    const generatorService = {
      generateProject: jest.fn().mockResolvedValue([{ path: 'README.md', content: 'hello' }]),
    };
    const accessPolicyService = createAccessPolicyService();
    const controller = new GeneratorController(
      generatorService as never,
      {} as never,
      accessPolicyService as never,
      {} as never,
    );

    await expect(controller.previewProject({
      basicInfo: { name: 'demo', packageManager: 'pnpm' },
      subProjects: { backend: true, admin: false, mobile: false },
      features: [],
      uiLibrary: { admin: false, mobile: false },
      hooks: false,
    }, req)).resolves.toEqual({
      files: [{ path: 'README.md', size: 5, preview: 'hello' }],
      totalFiles: 1,
    });

    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith({
      teamId: 'team-1',
      actorId: 'user-1',
      category: 'project',
      action: 'project.preview',
      targetType: 'project_preview',
      risk: 'low',
    });
  });

  it('checks preset import policy before importing shared config', async () => {
    const presetService = {
      importPreset: jest.fn().mockResolvedValue({ id: 'preset-1' }),
    };
    const accessPolicyService = createAccessPolicyService();
    const controller = new PresetController(
      presetService as never,
      accessPolicyService as never,
    );

    await expect(controller.importPreset(req, {
      name: 'standard',
      config: { packageManager: 'pnpm' },
    })).resolves.toEqual({ id: 'preset-1' });

    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith({
      teamId: 'team-1',
      actorId: 'user-1',
      category: 'preset',
      action: 'preset.import',
      targetType: 'preset',
      targetId: null,
      risk: 'low',
    });
  });

  it('checks git write policy before pushing generated files', async () => {
    const gitService = {
      pushToRepo: jest.fn().mockResolvedValue({ success: true, repo: 'org/demo' }),
    };
    const accessPolicyService = createAccessPolicyService();
    const controller = new GitController(
      gitService as never,
      accessPolicyService as never,
    );

    await expect(controller.pushFiles(req, {
      provider: 'github',
      repo: 'org/demo',
      files: [{ path: 'README.md', content: 'hello' }],
      message: 'Initial commit',
    })).resolves.toEqual({ success: true, repo: 'org/demo' });

    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith({
      teamId: 'team-1',
      actorId: 'user-1',
      category: 'git',
      action: 'git.repo.push',
      targetType: 'git_connection',
      targetId: 'github',
      risk: 'high',
    });
  });

  it('checks domain artifact policy before generating certbot script', async () => {
    const domainService = {
      generateCertbotScript: jest.fn().mockReturnValue('certbot renew'),
    };
    const accessPolicyService = createAccessPolicyService();
    const controller = new DomainController(
      domainService as never,
      accessPolicyService as never,
    );

    await expect(controller.generateCertbotScript({
      domain: 'demo.example.com',
      email: 'ops@example.com',
    }, req)).resolves.toEqual({
      domain: 'demo.example.com',
      script: 'certbot renew',
      filename: 'certbot-demo.example.com.sh',
    });

    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith({
      teamId: 'team-1',
      actorId: 'user-1',
      category: 'domain_config',
      action: 'domain.certbot_script.generate',
      targetType: 'domain_config_artifact',
      targetId: 'demo.example.com',
      risk: 'low',
    });
  });

  it('checks legacy CDN artifact policy before generating env config', async () => {
    const cdnService = {
      generateEnvConfig: jest.fn().mockReturnValue('CDN_PROVIDER=aliyun'),
    };
    const accessPolicyService = createAccessPolicyService();
    const controller = new CDNController(
      cdnService as never,
      accessPolicyService as never,
    );

    await expect(controller.generateEnvConfig({
      provider: CDNProvider.ALIYUN,
      domain: 'cdn.example.com',
      originDomain: 'origin.example.com',
      enableHttps: true,
    }, req)).resolves.toEqual({
      filename: '.env.cdn',
      content: 'CDN_PROVIDER=aliyun',
    });

    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith({
      teamId: 'team-1',
      actorId: 'user-1',
      category: 'cdn_artifact',
      action: 'cdn.env_config.generate',
      targetType: 'cdn_artifact',
      targetId: CDNProvider.ALIYUN,
      risk: 'low',
    });
  });
});
