import { Prisma } from "@prisma/client";
import type { ReleaseOrderListQueryInput } from "./release-order-list.types";

export function releaseOrderListFilter(input: ReleaseOrderListQueryInput) {
  const filters = [
    Prisma.sql`ro.teamId = ${input.teamId}`,
    Prisma.sql`ro.projectId = ${input.projectId}`,
    Prisma.sql`p.archivedAt IS NULL`,
  ];
  const query = input.query?.trim();
  if (query) filters.push(searchFilter(input, query));
  return Prisma.join(filters, " AND ");
}

function searchFilter(input: ReleaseOrderListQueryInput, query: string) {
  const pattern = `%${escapeLikeLiteral(query)}%`;
  const revision = buildRevision(query);
  const revisionFilter =
    revision === null
      ? Prisma.empty
      : Prisma.sql` OR br.revision = ${revision}`;
  return Prisma.sql`(
    LOWER(ro.releaseVersion) LIKE LOWER(${pattern}) ESCAPE '='
    OR LOWER(ro.releaseName) LIKE LOWER(${pattern}) ESCAPE '='
    OR LOWER(COALESCE(ro.note, '')) LIKE LOWER(${pattern}) ESCAPE '='
    OR EXISTS (
      SELECT 1 FROM BuildRun br
      WHERE br.teamId = ${input.teamId}
        AND br.projectId = ${input.projectId}
        AND br.releaseOrderId = ro.id
        AND (
          LOWER(br.id) LIKE LOWER(${pattern}) ESCAPE '='
          OR LOWER(br.sourceCommitSha) LIKE LOWER(${pattern}) ESCAPE '='
          ${revisionFilter}
        )
    )
    OR EXISTS (
      SELECT 1 FROM ArtifactManifest am
      WHERE am.teamId = ${input.teamId}
        AND am.projectId = ${input.projectId}
        AND am.releaseOrderId = ro.id
        AND (
          LOWER(am.id) LIKE LOWER(${pattern}) ESCAPE '='
          OR LOWER(am.digest) LIKE LOWER(${pattern}) ESCAPE '='
        )
    )
  )`;
}

export function escapeLikeLiteral(value: string) {
  return value
    .replaceAll("=", "==")
    .replaceAll("\\", "=\\")
    .replaceAll("%", "=%")
    .replaceAll("_", "=_");
}

function buildRevision(value: string) {
  const match = value.match(/^(?:build\s*#?\s*)?(\d+)$/i);
  if (!match) return null;
  const revision = Number(match[1]);
  return Number.isSafeInteger(revision) ? revision : null;
}
