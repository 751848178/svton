import { UnprocessableEntityException } from "@nestjs/common";
import { ReleasePolicyService } from "./release-policy.service";
import { ReleaseStrategyCapabilityService } from "./release-strategy-capability.service";

describe("ReleasePolicyService", () => {
  const repository = { get: jest.fn(), create: jest.fn() };
  const service = new ReleasePolicyService(
    repository as never,
    new ReleaseStrategyCapabilityService(),
  );

  beforeEach(() => jest.clearAllMocks());

  it("returns a safe standard default without pretending an advanced policy exists", async () => {
    repository.get.mockResolvedValue(null);
    await expect(service.get("team-1", "project-1")).resolves.toMatchObject({
      current: { strategy: "standard", synthetic: true },
      capabilities: expect.arrayContaining([
        expect.objectContaining({ strategy: "canary", executable: false }),
      ]),
    });
  });

  it.each(["canary", "blue_green", "automatic_traffic"] as const)(
    "rejects %s before persistence",
    async (strategy) => {
      await expect(service.create("team-1", "project-1", "user-1", { strategy }))
        .rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );
});

