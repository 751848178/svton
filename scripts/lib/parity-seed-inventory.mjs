export async function printParitySeedInventory({
  PrismaClient,
  dbUrl,
  dbName,
  ids,
}) {
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    const counts = {
      project: await prisma.project.count({ where: { id: ids.project } }),
      environment: await prisma.projectEnvironment.count({
        where: { projectId: ids.project },
      }),
      releaseOrder: await prisma.releaseOrder.count({
        where: { id: ids.order },
      }),
      buildRun: await prisma.buildRun.count({
        where: { projectId: ids.project },
      }),
      deploymentRun: await prisma.deploymentRun.count({
        where: { projectId: ids.project },
      }),
      repositoryConnection: await prisma.repositoryConnection.count({
        where: { projectId: ids.project },
      }),
      repositoryAnalysisRun: await prisma.repositoryAnalysisRun.count({
        where: { projectId: ids.project },
      }),
      site: await prisma.site.count({ where: { id: ids.site } }),
      secretKey: await prisma.secretKey.count({ where: { id: ids.secret } }),
      resourceInstance: await prisma.resourceInstance.count({
        where: { id: ids.resourceInstance },
      }),
      server: await prisma.server.count({ where: { id: ids.server } }),
      configRevision: await prisma.environmentConfigRevision.count({
        where: { projectId: ids.project },
      }),
      application: await prisma.application.count({
        where: { projectId: ids.project },
      }),
      applicationService: await prisma.applicationService.count({
        where: { projectId: ids.project },
      }),
      fixedIds: Object.values(ids),
    };
    const inventory = {
      database: dbName,
      capturedAt: new Date().toISOString(),
      counts,
      fixedIds: Object.values(ids),
    };
    console.log(`[parity-seed] inventory ${JSON.stringify(inventory)}`);
    return inventory;
  } finally {
    await prisma.$disconnect();
  }
}
