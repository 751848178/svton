import type { Prisma } from '../../generated/client/index.js';
import { proposedReleaseVersion, versionConflict } from './release-version.js';

/** Called in the task transaction, so failed starts never consume a version. */
export async function allocateTaskVersion(tx: Prisma.TransactionClient, projectId: string, proposed: string | null): Promise<string> {
  const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { lastVersion: true } });
  const version = proposedReleaseVersion(proposed, project.lastVersion);
  const allocated = await tx.project.updateMany({
    where: { id: projectId, lastVersion: project.lastVersion }, data: { lastVersion: version },
  });
  if (allocated.count !== 1) throw versionConflict();
  return version;
}
