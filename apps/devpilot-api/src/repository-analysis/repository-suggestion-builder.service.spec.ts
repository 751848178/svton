import { RepositorySuggestionBuilderService } from "./repository-suggestion-builder.service";

describe("RepositorySuggestionBuilderService artifact contract", () => {
  it("persists detected outputs as reviewed deploy artifact paths", async () => {
    const prisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({
          gitRepo: null,
          config: {},
          environments: [{ id: "environment-1" }],
          applications: [],
        }),
      },
    };
    const service = new RepositorySuggestionBuilderService(prisma as never);
    const drafts = await service.build(
      "team-1",
      "project-1",
      {
        id: "analysis-1",
        repositoryUrl: "https://example.com/repo.git",
        branch: "main",
        commitSha: "a".repeat(40),
      } as never,
      {
        repository: {
          monorepo: false,
          lockfiles: [],
          workspacePatterns: [],
        },
        services: [
          {
            key: "api",
            name: "api",
            path: "apps/api",
            role: "backend",
            deployable: true,
            artifactOnly: false,
            framework: ["NestJS"],
            versions: {},
            commands: { build: "pnpm build", start: "node dist/main.js" },
            ports: [3000],
            healthChecks: [],
            environment: [],
            databases: [],
            dependencies: [],
            container: {
              composeFiles: [],
              composeServices: [],
              dependsOn: [],
            },
            artifacts: ["apps/api/dist"],
            evidence: [],
            warnings: [],
          },
        ],
        composeCandidates: [],
        resourceRequirements: [],
        warnings: [],
        evidence: [],
      },
    );
    expect(drafts).toContainEqual(
      expect.objectContaining({
        kind: "application_service",
        proposedValue: expect.objectContaining({
          deployConfig: expect.objectContaining({
            artifactPaths: ["apps/api/dist"],
          }),
        }),
      }),
    );
  });
});
