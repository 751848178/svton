export async function requireActiveEnvironmentService(
  prisma,
  { projectId, environmentId, name },
) {
  const service = await prisma.applicationService.findFirst({
    where: {
      projectId,
      environmentId,
      name,
      status: "active",
    },
    select: { id: true },
  });
  if (!service) {
    throw new Error(`dynamic environment service missing: ${name}`);
  }
  return service.id;
}
