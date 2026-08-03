import { PrismaService } from "../prisma/prisma.service";
import { ProjectDirectoryRepository } from "./project-directory.repository";

describe("ProjectDirectoryRepository", () => {
  it("scopes the root query by team and reads runs only through project relations", async () => {
    const prisma = {
      project: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const repository = new ProjectDirectoryRepository(prisma);

    await repository.list("team-1", "payments");

    const query = (prisma.project.findMany as jest.Mock).mock.calls[0][0];
    expect(query.where).toEqual(
      expect.objectContaining({ teamId: "team-1", archivedAt: null }),
    );
    expect(query.where.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: "payments" } },
        { description: { contains: "payments" } },
        {
          repositoryConnection: {
            is: { repositoryUrl: { contains: "payments" } },
          },
        },
        { sites: { some: { primaryDomain: { contains: "payments" } } } },
        { proxyConfigs: { some: { domain: { contains: "payments" } } } },
      ]),
    );
    expect(query.select.repositoryAnalysisRuns).toMatchObject({
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    expect(query.select.deploymentRuns).toMatchObject({
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    expect(JSON.stringify(query.select)).not.toContain("repositoryUrl");
    expect(JSON.stringify(query.select)).not.toContain("logs");
    expect(JSON.stringify(query.select)).not.toContain('config"');
  });
});
