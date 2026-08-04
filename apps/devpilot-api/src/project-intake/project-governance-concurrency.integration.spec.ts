import {
  describeProjectIntakeIntegration,
  useProjectIntakeFinalizationIntegrationFixture,
} from "./project-intake-finalization.integration-fixture";

describeProjectIntakeIntegration("Project governance concurrency", () => {
  const fixture = useProjectIntakeFinalizationIntegrationFixture();

  it("does not duplicate generated identity, baselines or revisions", async () => {
    const idempotencyKey = "generated-concurrent";
    const draft = await fixture.generatedDrafts.prepare({
      teamId: fixture.teamId,
      actorId: fixture.actorId,
      name: "Generated concurrent",
      config: { basicInfo: { name: "Generated concurrent" } },
      idempotencyKey,
    });
    const finalize = () =>
      fixture.governance.finalize({
        teamId: fixture.teamId,
        projectId: draft.id,
        actorId: fixture.actorId,
        expectedStatus: "draft",
        expectedRevision: draft.onboardingRevision!,
        allowAlreadyReady: true,
        auditAction: "project.generate.finalize",
        auditSummary: "generated governance finalized",
      });

    const outcomes = await Promise.allSettled([finalize(), finalize()]);
    expect(outcomes.some(({ status }) => status === "fulfilled")).toBe(true);
    await finalize();

    await expect(
      fixture.prisma.project.count({ where: { id: draft.id } }),
    ).resolves.toBe(1);
    await expect(
      fixture.prisma.projectRepositoryIdentity.count({
        where: { projectId: draft.id },
      }),
    ).resolves.toBe(0);
    await expect(
      fixture.prisma.projectEnvironment.count({
        where: { projectId: draft.id, baselineRole: { not: null } },
      }),
    ).resolves.toBe(2);
    await expect(
      fixture.prisma.environmentConfigRevision.count({
        where: { projectId: draft.id },
      }),
    ).resolves.toBe(2);
  });
});
