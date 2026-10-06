import { projectDeliverySummaryRecord } from "./project-delivery-summary.fixture";
import { presentProjectDeliverySummary } from "./project-delivery-summary.presenter";

describe("project delivery remediation routes", () => {
  it("opens repository analysis for intake and baseline repair", () => {
    const intakeRecord = projectDeliverySummaryRecord();
    intakeRecord.intakeFinalizations = [];
    expect(
      presentProjectDeliverySummary(
        intakeRecord,
        "actor-1",
        "ssh-v1",
      ).checkpoints.find((item) => item.id === "intake"),
    ).toMatchObject({
      action: {
        kind: "review_repository",
        href: "/projects/project-1/repository-analysis",
      },
    });

    const baselineRecord = projectDeliverySummaryRecord();
    baselineRecord.environments = baselineRecord.environments.filter(
      (environment) => environment.baselineRole !== "production",
    );
    expect(
      presentProjectDeliverySummary(
        baselineRecord,
        "actor-1",
        "ssh-v1",
      ).checkpoints.find((item) => item.id === "baseline_topology"),
    ).toMatchObject({
      action: {
        kind: "repair_baselines",
        href: "/projects/project-1/repository-analysis",
      },
    });
  });
});
