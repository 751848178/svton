import { ProjectEnvironmentConfigController } from "./project-environment-config.controller";

describe("ProjectEnvironmentConfigController", () => {
  const request = {
    teamId: "team-1",
    user: { id: "user-1" },
  } as never;
  const scope = { projectId: "project-1", environmentId: "env-1" };

  it("checks read policy before returning immutable revisions", async () => {
    const environmentService = { getAccessScope: jest.fn().mockResolvedValue(scope) };
    const revisionService = { list: jest.fn().mockResolvedValue({ revisions: [] }) };
    const readPolicy = { assertCanReadEnvironment: jest.fn().mockResolvedValue(undefined) };
    const controller = new ProjectEnvironmentConfigController(
      environmentService as never, revisionService as never,
      readPolicy as never, {} as never,
    );
    await controller.list(request, "env-1");
    expect(readPolicy.assertCanReadEnvironment).toHaveBeenCalledWith(
      request, "env-1", "project-1", "env-1",
    );
    expect(revisionService.list).toHaveBeenCalledWith("team-1", "env-1");
  });

  it("checks write policy before creating a revision", async () => {
    const environmentService = { getAccessScope: jest.fn().mockResolvedValue(scope) };
    const revisionService = { create: jest.fn().mockResolvedValue({ revision: { id: "revision-2" } }) };
    const writePolicy = { assertCanCreateConfigRevision: jest.fn().mockResolvedValue(undefined) };
    const controller = new ProjectEnvironmentConfigController(
      environmentService as never, revisionService as never,
      {} as never, writePolicy as never,
    );
    const dto = { plainVariables: { NODE_ENV: "production" } };
    await controller.create(request, "env-1", dto);
    expect(writePolicy.assertCanCreateConfigRevision).toHaveBeenCalledWith(request, scope);
    expect(revisionService.create).toHaveBeenCalledWith("team-1", "user-1", "env-1", dto);
  });
});
