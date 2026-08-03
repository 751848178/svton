import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectDuplicateGuardService } from './project-duplicate-guard.service';

describe('ProjectDuplicateGuardService', () => {
  it('rejects an imported project when the team already controls the same repository', async () => {
    const prisma = {
      project: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'existing-1',
            name: 'Picshare',
            gitRepo: 'git@github.com:org/picshare.git',
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new ProjectDuplicateGuardService(prisma);

    await expect(service.assertNoDuplicateRepository('team-1', 'https://github.com/org/picshare')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows generated projects without repository identity', async () => {
    const prisma = {
      project: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const service = new ProjectDuplicateGuardService(prisma);

    await service.assertNoDuplicateRepository('team-1', undefined);

    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });
});
