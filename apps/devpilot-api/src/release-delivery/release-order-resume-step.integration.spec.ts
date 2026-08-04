import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseOrderDetailRepository } from "./release-order-detail.repository";
import { ReleaseOrderListRepository } from "./release-order-list.repository";
import { ReleaseOrderListService } from "./release-order-list.service";
import { ReleaseOrderResumeStepFixture } from "./release-order-resume-step.integration-fixture";

const describeIntegration =
  process.env.RUN_RELEASE_ORDER_RESUME_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("release order resume step real MySQL integration", () => {
  const prisma = new PrismaClient();
  const fixture = new ReleaseOrderResumeStepFixture(prisma);
  const db = prisma as unknown as PrismaService;
  const details = new ReleaseOrderDetailRepository(db);
  const list = new ReleaseOrderListService(new ReleaseOrderListRepository(db));

  beforeAll(() => fixture.setup());
  afterAll(() => fixture.cleanup());

  it.each([
    ["preflight", "preflight"],
    ["buildFailed", "build"],
    ["stagingRetry", "staging"],
    ["productionRun", "production"],
    ["productionMismatch", "production"],
    ["invalid", "build"],
    ["withdrawBefore", "preflight"],
    ["withdrawStaging", "staging"],
  ] as const)(
    "derives %s from accepted structural evidence only",
    async (key, expected) => {
      expect((await detail(key)).resumeStep).toBe(expected);
    },
  );

  it("does not let archived baseline evidence advance resume", async () => {
    const result = await details.find(
      fixture.teamId,
      fixture.archivedProjectId,
      fixture.ids.archived,
    );
    expect(required(result).resumeStep).toBe("build");
  });

  it("keeps the mismatch lifecycle failure while resuming at production", async () => {
    expect(await detail("productionMismatch")).toMatchObject({
      resumeStep: "production",
      lifecycle: {
        status: "failed",
        phase: "production",
        failureKind: "evidence_mismatch",
      },
    });
  });

  it("preserves list/detail lifecycle and rejects cross-scope detail reads", async () => {
    const result = await list.list(
      fixture.teamId,
      fixture.userId,
      fixture.projectId,
      { take: 50 },
    );
    for (const item of result.items) {
      expect((await detailById(item.id)).lifecycle).toEqual(item.lifecycle);
    }
    expect(
      await details.find(
        fixture.otherTeamId,
        fixture.projectId,
        fixture.ids.productionRun,
      ),
    ).toBeNull();
    expect(
      await details.find(
        fixture.teamId,
        fixture.otherProjectId,
        fixture.ids.productionRun,
      ),
    ).toBeNull();
  });

  function detail(key: keyof typeof fixture.ids) {
    return detailById(fixture.ids[key]);
  }

  async function detailById(id: string) {
    return required(await details.find(fixture.teamId, fixture.projectId, id));
  }
});

function required<T>(value: T | null | undefined): T {
  if (!value) throw new Error("Expected release order detail");
  return value;
}
