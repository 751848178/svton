import { ProjectIntakeAccessService } from "./project-intake-access.service";
import { ProjectIntakeController } from "./project-intake.controller";
import { ProjectIntakeService } from "./project-intake.service";

const request = { teamId: "team-1", user: { id: "user-1" } };

function setup() {
  const intake = {
    createDraft: jest.fn().mockResolvedValue({ id: "project-1" }),
    state: jest.fn().mockResolvedValue({ project: { id: "project-1" } }),
    finalize: jest.fn().mockResolvedValue({ projectId: "project-1" }),
  } as unknown as ProjectIntakeService;
  const access = {
    assertCreate: jest.fn().mockResolvedValue(undefined),
    assertRead: jest.fn().mockResolvedValue(undefined),
    assertWrite: jest.fn().mockResolvedValue(undefined),
  } as unknown as ProjectIntakeAccessService;
  return {
    intake,
    access,
    controller: new ProjectIntakeController(intake, access),
  };
}

describe("ProjectIntakeController access", () => {
  it("does not create a draft when project creation permission is denied", async () => {
    const { intake, access, controller } = setup();
    (access.assertCreate as jest.Mock).mockRejectedValue(new Error("denied"));

    await expect(
      controller.createDraft(request, { name: "Demo" }),
    ).rejects.toThrow("denied");

    expect(intake.createDraft).not.toHaveBeenCalled();
  });

  it("checks project-scoped read permission before returning intake state", async () => {
    const { intake, access, controller } = setup();

    await controller.state(request, "project-1");

    expect(access.assertRead).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
    });
    expect(intake.state).toHaveBeenCalledWith("team-1", "user-1", "project-1");
  });

  it("checks project-scoped finalize permission before executing", async () => {
    const { intake, access, controller } = setup();
    const dto = { analysisRunId: "run-1", idempotencyKey: "key-1" };

    await controller.finalize(request, "project-1", dto);

    expect(access.assertWrite).toHaveBeenCalledWith(
      { teamId: "team-1", actorId: "user-1", projectId: "project-1" },
      "project.intake.finalize",
    );
    expect(intake.finalize).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      "project-1",
      dto,
    );
  });
});
