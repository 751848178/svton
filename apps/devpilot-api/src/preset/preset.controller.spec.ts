import { ControlAccessPolicyService } from '../control-access-policy';
import { PresetController } from './preset.controller';
import { PresetService } from './preset.service';

describe('PresetController authorization', () => {
  const req = { user: { id: 'user-1' }, teamId: 'team-1' };

  let presetService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    exportPreset: jest.Mock;
    importPreset: jest.Mock;
  };
  let accessPolicyService: {
    assertCanSelfServiceWrite: jest.Mock;
    assertCanRead: jest.Mock;
    canRead: jest.Mock;
  };
  let controller: PresetController;

  beforeEach(() => {
    presetService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      exportPreset: jest.fn(),
      importPreset: jest.fn(),
    };
    accessPolicyService = {
      assertCanSelfServiceWrite: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      canRead: jest.fn().mockResolvedValue(true),
    };
    controller = new PresetController(
      presetService as unknown as PresetService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters preset lists through control read policy', async () => {
    presetService.findAll.mockResolvedValue([preset('preset-allowed'), preset('preset-denied')]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'preset-allowed')
    ));

    await expect(controller.findAll(req)).resolves.toEqual([preset('preset-allowed')]);
    expect(presetService.findAll).toHaveBeenCalledWith(req.teamId);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'preset',
      action: 'preset.read',
      targetType: 'preset',
      targetId: 'preset-denied',
      risk: 'low',
    }));
  });

  it('checks detail and export read access before delegating', async () => {
    presetService.findOne.mockResolvedValue({ ...preset('preset-1'), config: { packageManager: 'pnpm' } });
    presetService.exportPreset.mockResolvedValue({ name: 'preset-1', version: '1.0' });

    await expect(controller.findOne(req, 'preset-1')).resolves.toEqual({
      ...preset('preset-1'),
      config: { packageManager: 'pnpm' },
    });
    await expect(controller.exportPreset(req, 'preset-1')).resolves.toEqual({ name: 'preset-1', version: '1.0' });
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'preset',
      action: 'preset.read',
      targetType: 'preset',
      targetId: 'preset-1',
      risk: 'low',
    }));
    expect(presetService.exportPreset).toHaveBeenCalledWith(req.teamId, 'preset-1');
  });

  it('checks create update delete and import write gates', async () => {
    presetService.create.mockResolvedValue(preset('preset-new'));
    presetService.update.mockResolvedValue(preset('preset-1'));
    presetService.remove.mockResolvedValue({ success: true });
    presetService.importPreset.mockResolvedValue(preset('preset-imported'));
    const dto = { name: 'standard', config: { packageManager: 'pnpm' } };

    await expect(controller.create(req, dto)).resolves.toEqual(preset('preset-new'));
    await expect(controller.update(req, 'preset-1', { name: 'renamed' })).resolves.toEqual(preset('preset-1'));
    await expect(controller.remove(req, 'preset-1')).resolves.toEqual({ success: true });
    await expect(controller.importPreset(req, dto)).resolves.toEqual(preset('preset-imported'));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'preset.create',
      targetId: null,
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'preset.update',
      targetId: 'preset-1',
      risk: 'low',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'preset.delete',
      targetId: 'preset-1',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'preset.import',
      targetId: null,
      risk: 'low',
    }));
  });

  it('does not delegate reads or writes when access is denied', async () => {
    accessPolicyService.assertCanRead.mockRejectedValueOnce(new Error('preset read denied'));
    await expect(controller.exportPreset(req, 'preset-1')).rejects.toThrow('preset read denied');
    expect(presetService.exportPreset).not.toHaveBeenCalled();

    accessPolicyService.assertCanSelfServiceWrite.mockRejectedValueOnce(new Error('preset write denied'));
    await expect(controller.remove(req, 'preset-1')).rejects.toThrow('preset write denied');
    expect(presetService.remove).not.toHaveBeenCalled();
  });
});

function preset(id: string) {
  return { id, name: id };
}
