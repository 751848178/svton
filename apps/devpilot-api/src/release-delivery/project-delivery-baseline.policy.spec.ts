import {
  isProjectDeliveryBaseline,
  presentProjectDeliveryBaseline,
} from "./project-delivery-baseline.policy";

describe("shared project delivery baseline facts", () => {
  const project = { id: "project-1", teamId: "team-1" };
  const baseline = {
    id: "env-1", teamId: "team-1", projectId: "project-1",
    key: "staging", name: "Staging", status: "active", baselineRole: "staging",
    identityLockedAt: new Date(), currentConfigRevisionId: "revision-1",
    currentConfigRevision: {
      id: "revision-1", teamId: "team-1", projectId: "project-1", environmentId: "env-1",
    },
  };

  it("uses one exact active/scope/config fact for directory and detail", () => {
    expect(isProjectDeliveryBaseline(project, baseline, "staging")).toBe(true);
    expect(presentProjectDeliveryBaseline(project, baseline).ready).toBe(true);
  });

  it.each([
    { currentConfigRevisionId: "revision-stale" },
    { currentConfigRevision: null },
    { identityLockedAt: null },
  ])("fails closed for baseline drift %#", (drift) => {
    expect(presentProjectDeliveryBaseline(project, { ...baseline, ...drift }).ready).toBe(false);
  });
});
