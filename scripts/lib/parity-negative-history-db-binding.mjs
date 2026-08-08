export async function bindNegativeHistoryContext(prisma, context) {
  const [project, order, manifests, crossOrder] = await Promise.all([
    prisma.project.findUnique({
      where: { id: context.projectId },
      select: { id: true, teamId: true },
    }),
    prisma.releaseOrder.findUnique({
      where: { id: context.orderId },
      select: { id: true, teamId: true, projectId: true },
    }),
    prisma.artifactManifest.findMany({
      where: { id: { in: [context.manifestM1, context.manifestM2] } },
      select: manifestSelect(),
    }),
    prisma.artifactManifest.findFirst({
      where: {
        teamId: context.teamId,
        projectId: context.projectId,
        releaseOrderId: { not: context.orderId },
        buildRun: { status: "succeeded" },
      },
      orderBy: { createdAt: "desc" },
      select: manifestSelect(),
    }),
  ]);
  requireValue(
    project?.id === context.projectId && project.teamId === context.teamId,
    "history project binding mismatch",
  );
  requireValue(
    order?.id === context.orderId &&
      order.teamId === context.teamId &&
      order.projectId === context.projectId,
    "history order binding mismatch",
  );
  requireValue(manifests.length === 2, "history manifests missing");
  validateManifest(
    manifests.find((row) => row.id === context.manifestM1),
    context,
    {
      buildRunId: context.buildRunM1,
      digest: context.manifestM1Digest,
    },
  );
  validateManifest(
    manifests.find((row) => row.id === context.manifestM2),
    context,
    {
      buildRunId: context.buildRunM2,
      digest: context.manifestM2Digest,
    },
  );
  validateCrossOrder(crossOrder, context);
  return Object.freeze({
    ...context,
    crossOrderManifestId: crossOrder.id,
    crossOrderReleaseOrderId: crossOrder.releaseOrderId,
    databaseBindingValid: true,
  });
}

function manifestSelect() {
  return {
    id: true,
    teamId: true,
    projectId: true,
    releaseOrderId: true,
    buildRunId: true,
    digest: true,
    buildRun: {
      select: {
        id: true,
        teamId: true,
        projectId: true,
        releaseOrderId: true,
        status: true,
      },
    },
    releaseOrder: { select: { id: true, teamId: true, projectId: true } },
  };
}

function validateManifest(row, context, expected) {
  requireValue(row, "history manifest missing");
  requireValue(
    row.teamId === context.teamId && row.projectId === context.projectId,
    "history manifest scope mismatch",
  );
  requireValue(
    row.releaseOrderId === context.orderId &&
      row.releaseOrder?.id === context.orderId,
    "history manifest order mismatch",
  );
  requireValue(
    row.releaseOrder.teamId === context.teamId &&
      row.releaseOrder.projectId === context.projectId,
    "history manifest order scope mismatch",
  );
  requireValue(
    row.buildRunId === expected.buildRunId && row.digest === expected.digest,
    "history manifest identity mismatch",
  );
  requireValue(
    row.buildRun?.id === expected.buildRunId &&
      row.buildRun.status === "succeeded",
    "history build status mismatch",
  );
  requireValue(
    row.buildRun.teamId === context.teamId &&
      row.buildRun.projectId === context.projectId &&
      row.buildRun.releaseOrderId === context.orderId,
    "history build scope mismatch",
  );
}

function validateCrossOrder(row, context) {
  requireValue(row, "history cross-order manifest missing");
  requireValue(
    row.id !== context.manifestM1 && row.id !== context.manifestM2,
    "history cross-order manifest reused",
  );
  requireValue(
    row.teamId === context.teamId && row.projectId === context.projectId,
    "history cross-order scope mismatch",
  );
  requireValue(
    row.releaseOrderId !== context.orderId &&
      row.releaseOrder?.id === row.releaseOrderId,
    "history cross-order order mismatch",
  );
  requireValue(
    row.releaseOrder.teamId === context.teamId &&
      row.releaseOrder.projectId === context.projectId,
    "history cross-order order scope mismatch",
  );
  requireValue(
    row.buildRun?.status === "succeeded" &&
      row.buildRun.releaseOrderId === row.releaseOrderId,
    "history cross-order build mismatch",
  );
  requireValue(
    row.buildRun.teamId === context.teamId &&
      row.buildRun.projectId === context.projectId,
    "history cross-order build scope mismatch",
  );
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
}
