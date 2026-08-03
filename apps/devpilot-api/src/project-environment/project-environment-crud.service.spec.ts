import { BadRequestException } from "@nestjs/common";
import { ProjectEnvironmentCrudService } from "./project-environment-crud.service";

describe("ProjectEnvironmentCrudService identity lock", () => {
  it("rejects key mutation after a deployment exists", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue({
        id: "env-1", key: "staging", identityLockedAt: null,
      }),
      findDeploymentRuns: jest.fn().mockResolvedValue([{ id: "run-1" }]),
      updateProjectEnvironment: jest.fn(),
    };
    const service = new ProjectEnvironmentCrudService(repo as never, {} as never);
    await expect(service.update("team-1", "env-1", { key: "preview" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateProjectEnvironment).not.toHaveBeenCalled();
  });

  it("keeps display-name updates available after identity lock", async () => {
    const updated = { id: "env-1", key: "staging", name: "预发" };
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue({
        id: "env-1", key: "staging", identityLockedAt: new Date(),
      }),
      findDeploymentRuns: jest.fn(),
      updateProjectEnvironment: jest.fn().mockResolvedValue(updated),
    };
    const service = new ProjectEnvironmentCrudService(repo as never, {} as never);
    await expect(service.update("team-1", "env-1", { name: "预发" })).resolves.toEqual(updated);
    expect(repo.findDeploymentRuns).not.toHaveBeenCalled();
  });
});
