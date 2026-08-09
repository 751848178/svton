const FIXED_PROJECT_ID = "parity-project-0001";

export async function detachParitySeedProject(PrismaClient, databaseUrl) {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  try {
    await prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.secretKey.updateMany({
          where: { projectId: FIXED_PROJECT_ID },
          data: { projectId: null, environmentId: null },
        }),
        tx.resourceInstance.updateMany({
          where: { projectId: FIXED_PROJECT_ID },
          data: { projectId: null, environmentId: null },
        }),
        tx.site.updateMany({
          where: { projectId: FIXED_PROJECT_ID },
          data: { projectId: null, environmentId: null },
        }),
        tx.managedResource.updateMany({
          where: { projectId: FIXED_PROJECT_ID },
          data: { projectId: null, environmentId: null },
        }),
        tx.resourceConnectionRun.updateMany({
          where: { projectId: FIXED_PROJECT_ID },
          data: { projectId: null, environmentId: null },
        }),
        tx.resourceMetricSnapshot.updateMany({
          where: { projectId: FIXED_PROJECT_ID },
          data: { projectId: null, environmentId: null },
        }),
        tx.backupRun.updateMany({
          where: { projectId: FIXED_PROJECT_ID },
          data: { projectId: null, environmentId: null },
        }),
        tx.logStream.updateMany({
          where: { projectId: FIXED_PROJECT_ID },
          data: { projectId: null, environmentId: null },
        }),
        tx.logCollectionRun.updateMany({
          where: { projectId: FIXED_PROJECT_ID },
          data: { projectId: null, environmentId: null },
        }),
      ]);
      await tx.project.deleteMany({ where: { id: FIXED_PROJECT_ID } });
    });
    const [fixedProjects, projects, primitives] = await Promise.all([
      prisma.project.count({ where: { id: FIXED_PROJECT_ID } }),
      prisma.project.count(),
      Promise.all([
        prisma.server.count({ where: { id: "parity-server-0001" } }),
        prisma.secretKey.count({
          where: { id: "parity-secret-0001", projectId: null },
        }),
        prisma.resourceInstance.count({
          where: { id: "parity-resource-0001", projectId: null },
        }),
        prisma.site.count({
          where: { id: "parity-site-0001", projectId: null },
        }),
      ]),
    ]);
    if (
      fixedProjects !== 0 ||
      projects !== 0 ||
      primitives.some((count) => count !== 1)
    ) {
      throw bootstrapError("readback");
    }
    return Object.freeze({ fixedProjects, projects, primitives });
  } finally {
    await prisma.$disconnect();
  }
}

function bootstrapError(reason) {
  return new Error(`PARITY_BOOTSTRAP_INVALID: ${reason}`);
}
