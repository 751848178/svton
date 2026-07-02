import { ControlAccessPolicyService } from '../control-access-policy';
import { GitController } from './git.controller';
import { GitService } from './git.service';

describe('GitController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let gitService: {
    saveConnection: jest.Mock;
    getConnections: jest.Mock;
    removeConnection: jest.Mock;
    listRepos: jest.Mock;
    createRepo: jest.Mock;
    pushToRepo: jest.Mock;
  };
  let accessPolicyService: {
    assertCanRead: jest.Mock;
    assertCanSelfServiceWrite: jest.Mock;
  };
  let controller: GitController;

  beforeEach(() => {
    gitService = {
      saveConnection: jest.fn(),
      getConnections: jest.fn(),
      removeConnection: jest.fn(),
      listRepos: jest.fn(),
      createRepo: jest.fn(),
      pushToRepo: jest.fn(),
    };
    accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanSelfServiceWrite: jest.fn().mockResolvedValue({ allowed: true }),
    };
    controller = new GitController(
      gitService as unknown as GitService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('checks Git connection list read access before delegating', async () => {
    gitService.getConnections.mockResolvedValue([
      { provider: 'github', username: 'octo' },
    ]);

    await expect(controller.getConnections(req)).resolves.toEqual([
      { provider: 'github', username: 'octo' },
    ]);
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'git',
      action: 'git.connections.read',
      targetType: 'git_connection',
      targetId: null,
      risk: 'low',
    });
    expect(gitService.getConnections).toHaveBeenCalledWith(req.user.id);
  });

  it('checks provider repo list read access before delegating', async () => {
    gitService.listRepos.mockResolvedValue([
      { id: 'repo-1', name: 'demo', fullName: 'octo/demo', private: true },
    ]);

    await expect(controller.listRepos(req, 'github')).resolves.toEqual([
      { id: 'repo-1', name: 'demo', fullName: 'octo/demo', private: true },
    ]);
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'git',
      action: 'git.repos.list',
      targetType: 'git_connection',
      targetId: 'github',
      risk: 'medium',
    }));
    expect(gitService.listRepos).toHaveBeenCalledWith(req.user.id, 'github');
  });

  it('checks connect and delete as high-risk Git connection writes', async () => {
    gitService.saveConnection.mockResolvedValue({ provider: 'github', username: 'octo' });
    gitService.removeConnection.mockResolvedValue({ success: true });

    await expect(controller.connect(req, {
      provider: 'github',
      accessToken: 'token',
      refreshToken: 'refresh',
    })).resolves.toEqual({ provider: 'github', username: 'octo' });
    await expect(controller.removeConnection(req, 'github')).resolves.toEqual({ success: true });

    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'git',
      action: 'git.connect',
      targetType: 'git_connection',
      targetId: 'github',
      risk: 'high',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'git.connection.delete',
      targetId: 'github',
      risk: 'high',
    }));
    expect(gitService.saveConnection).toHaveBeenCalledWith(
      req.user.id,
      'github',
      'token',
      'refresh',
    );
    expect(gitService.removeConnection).toHaveBeenCalledWith(req.user.id, 'github');
  });

  it('checks create and push as high-risk Git repo writes', async () => {
    gitService.createRepo.mockResolvedValue({ id: 'repo-1', name: 'demo' });
    gitService.pushToRepo.mockResolvedValue({ success: true, repo: 'octo/demo' });
    const files = [{ path: 'README.md', content: '# Demo' }];

    await expect(controller.createRepo(req, {
      provider: 'github',
      name: 'demo',
      description: 'Demo repo',
      private: true,
    })).resolves.toEqual({ id: 'repo-1', name: 'demo' });
    await expect(controller.pushFiles(req, {
      provider: 'github',
      repo: 'octo/demo',
      files,
      message: 'Initial commit',
    })).resolves.toEqual({ success: true, repo: 'octo/demo' });

    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'git.repo.create',
      targetId: 'github',
      risk: 'high',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'git.repo.push',
      targetId: 'github',
      risk: 'high',
    }));
    expect(gitService.createRepo).toHaveBeenCalledWith(req.user.id, 'github', {
      name: 'demo',
      description: 'Demo repo',
      private: true,
    });
    expect(gitService.pushToRepo).toHaveBeenCalledWith(
      req.user.id,
      'github',
      'octo/demo',
      files,
      'Initial commit',
    );
  });

  it('does not delegate Git writes when access is denied', async () => {
    accessPolicyService.assertCanSelfServiceWrite.mockRejectedValue(new Error('git denied'));

    await expect(controller.pushFiles(req, {
      provider: 'gitlab',
      repo: 'group/demo',
      files: [{ path: 'README.md', content: '# Demo' }],
    })).rejects.toThrow('git denied');
    expect(gitService.pushToRepo).not.toHaveBeenCalled();
  });
});
