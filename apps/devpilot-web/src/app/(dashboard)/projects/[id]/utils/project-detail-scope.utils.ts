/** Project detail APIs are tenant-scoped and must wait for both identities. */
export function shouldLoadProjectDetail(actorId: string | null, teamId: string | null) {
  return Boolean(actorId && teamId);
}
